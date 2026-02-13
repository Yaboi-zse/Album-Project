/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MUSICBRAINZ_USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT || "AlbumProjectGenreBackfill/1.0 (local)";

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let spotifyToken = null;
let spotifyTokenExp = 0;
const artistGenresCache = new Map();
const artistNameCache = new Map();
const artistDbGenresCache = new Map();
const artistGenresByNameCache = new Map();
const lastFmAlbumGenresCache = new Map();
const lastFmArtistGenresCache = new Map();
const musicBrainzArtistGenresCache = new Map();
const FETCH_TIMEOUT_MS = Number(process.env.GENRE_FETCH_TIMEOUT_MS || 15000);
let musicBrainzLastRequestAt = 0;

const GENRE_BLACKLIST = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "my favorites",
  "under 2000 listeners",
  "albums i own",
  "spotify",
  "unknown",
  "misc",
]);

const COMMON_MOJIBAKE_MAP = {
  "Ä…": "ą",
  "Ä‡": "ć",
  "Ä™": "ę",
  "Å‚": "ł",
  "Å„": "ń",
  "Ã³": "ó",
  "Å›": "ś",
  "Åº": "ź",
  "Å¼": "ż",
  "Ä„": "Ą",
  "Ä†": "Ć",
  "Ä": "Ę",
  "Å": "Ł",
  "Åƒ": "Ń",
  "Ã“": "Ó",
  "Åš": "Ś",
  "Å¹": "Ź",
  "Å»": "Ż",
  "Ĺ‚": "ł",
  "Ĺ": "ł",
  "Ĺ": "ś",
  "Ĺ": "ń",
  "Ĺ¼": "ż",
  "Ĺş": "ź",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getSpotifyToken() {
  const now = Date.now();
  if (spotifyToken && now < spotifyTokenExp) return spotifyToken;

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify token error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExp = now + Number(data.expires_in || 3600) * 1000 - 10000;
  return spotifyToken;
}

async function spotifyFetch(url, attempt = 0) {
  const token = await getSpotifyToken();
  let res;
  try {
    res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    if ((err && err.name === "AbortError") || /aborted/i.test(String(err?.message || ""))) {
      if (attempt < 3) {
        await sleep(1000 * (attempt + 1));
        return spotifyFetch(url, attempt + 1);
      }
      throw new Error(`Spotify request timeout after retries: ${url}`);
    }
    throw err;
  }

  if (res.status === 401 && attempt < 1) {
    spotifyToken = null;
    return spotifyFetch(url, attempt + 1);
  }

  if (res.status === 429 && attempt < 5) {
    const retryAfterSec = Math.min(10, Number(res.headers.get("retry-after") || "1"));
    await sleep((retryAfterSec + 1) * 1000);
    return spotifyFetch(url, attempt + 1);
  }

  return res;
}

function normalizeGenres(genres) {
  if (!Array.isArray(genres)) return [];
  return Array.from(new Set(genres.map((g) => String(g || "").trim().toLowerCase()).filter(Boolean)))
    .filter((g) => g.length >= 2 && g.length <= 40 && !GENRE_BLACKLIST.has(g))
    .sort();
}

function fixMojibake(value) {
  let out = String(value || "");
  for (const [bad, good] of Object.entries(COMMON_MOJIBAKE_MAP)) {
    if (!out.includes(bad)) continue;
    out = out.split(bad).join(good);
  }
  return out;
}

async function fetchArtistGenres(artistSpotifyId) {
  if (!artistSpotifyId) return [];
  if (artistGenresCache.has(artistSpotifyId)) return artistGenresCache.get(artistSpotifyId);

  const res = await spotifyFetch(`https://api.spotify.com/v1/artists/${artistSpotifyId}`);
  if (!res.ok) {
    artistGenresCache.set(artistSpotifyId, []);
    return [];
  }
  const artist = await res.json();
  const genres = normalizeGenres(artist?.genres);
  artistGenresCache.set(artistSpotifyId, genres);
  return genres;
}

async function fetchAlbumGenres(albumSpotifyId) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${albumSpotifyId}`);
  if (!res.ok) return [];

  const album = await res.json();
  let genres = normalizeGenres(album?.genres);
  if (genres.length > 0) return genres;

  const primaryArtistSpotifyId = album?.artists?.[0]?.id || null;
  genres = await fetchArtistGenres(primaryArtistSpotifyId);
  return genres;
}

function normalizeText(value) {
  return fixMojibake(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeDiacritics(value) {
  return fixMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractTagNames(tagsNode) {
  if (!tagsNode) return [];
  const tagArray = Array.isArray(tagsNode) ? tagsNode : [tagsNode];
  return tagArray
    .map((t) => (typeof t === "string" ? t : t?.name))
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

async function fetchJsonWithRetries(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfterSec = Math.min(10, Number(res.headers.get("retry-after") || "1"));
        await sleep((retryAfterSec + 1) * 1000);
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.error) return null;
      return data;
    } catch (err) {
      if (attempt >= maxRetries) return null;
      await sleep(750 * (attempt + 1));
    }
  }
  return null;
}

async function fetchLastFmAlbumGenres(title, artistName) {
  if (!LASTFM_API_KEY) return [];
  const safeTitle = fixMojibake(title).trim();
  const safeArtist = fixMojibake(artistName).trim();
  const cacheKey = `${normalizeText(safeArtist)}::${normalizeText(safeTitle)}`;
  if (lastFmAlbumGenresCache.has(cacheKey)) return lastFmAlbumGenresCache.get(cacheKey);

  const url =
    `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${encodeURIComponent(LASTFM_API_KEY)}` +
    `&artist=${encodeURIComponent(safeArtist)}` +
    `&album=${encodeURIComponent(safeTitle)}` +
    `&autocorrect=1&format=json`;

  const data = await fetchJsonWithRetries(url, {}, 2);
  const rawTags = extractTagNames(data?.album?.tags?.tag);
  const genres = normalizeGenres(rawTags);
  lastFmAlbumGenresCache.set(cacheKey, genres);
  return genres;
}

async function fetchLastFmArtistGenres(artistName) {
  const cleanArtist = fixMojibake(artistName).trim();
  if (!LASTFM_API_KEY || !cleanArtist) return [];
  const cacheKey = normalizeText(cleanArtist);
  if (lastFmArtistGenresCache.has(cacheKey)) return lastFmArtistGenresCache.get(cacheKey);

  const url =
    `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&api_key=${encodeURIComponent(LASTFM_API_KEY)}` +
    `&artist=${encodeURIComponent(cleanArtist)}` +
    `&autocorrect=1&format=json`;

  const data = await fetchJsonWithRetries(url, {}, 2);
  const rawTags = extractTagNames(data?.toptags?.tag);
  const genres = normalizeGenres(rawTags);
  lastFmArtistGenresCache.set(cacheKey, genres);
  return genres;
}

function scoreArtistNameSimilarity(candidateName, wantedName) {
  const c = normalizeText(candidateName);
  const w = normalizeText(wantedName);
  if (!c || !w) return 0;
  if (c === w) return 10;
  if (c.startsWith(w) || w.startsWith(c)) return 6;
  if (c.includes(w) || w.includes(c)) return 3;
  return 0;
}

async function musicBrainzFetchJson(url) {
  const now = Date.now();
  const delta = now - musicBrainzLastRequestAt;
  if (delta < 1100) {
    await sleep(1100 - delta);
  }
  musicBrainzLastRequestAt = Date.now();
  return fetchJsonWithRetries(
    url,
    {
      headers: {
        "User-Agent": MUSICBRAINZ_USER_AGENT,
        Accept: "application/json",
      },
    },
    2
  );
}

async function fetchMusicBrainzArtistGenres(artistName) {
  const cleanArtist = fixMojibake(artistName).trim();
  if (!cleanArtist) return [];
  const cacheKey = normalizeText(cleanArtist);
  if (musicBrainzArtistGenresCache.has(cacheKey)) return musicBrainzArtistGenresCache.get(cacheKey);

  const queries = Array.from(
    new Set(
      [
        `artist:"${cleanArtist}"`,
        cleanArtist,
        removeDiacritics(cleanArtist) !== cleanArtist ? `artist:"${removeDiacritics(cleanArtist)}"` : "",
      ].filter(Boolean)
    )
  );

  let bestArtist = null;
  let bestScore = -1;
  for (const query of queries) {
    const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const searchData = await musicBrainzFetchJson(searchUrl);
    const candidates = searchData?.artists || [];
    for (const c of candidates) {
      const scoreFromMb = Number(c?.score || 0) / 20;
      const scoreFromName = scoreArtistNameSimilarity(c?.name, cleanArtist);
      const score = scoreFromMb + scoreFromName;
      if (score > bestScore) {
        bestArtist = c;
        bestScore = score;
      }
    }
  }

  if (!bestArtist?.id) {
    musicBrainzArtistGenresCache.set(cacheKey, []);
    return [];
  }

  const detailsUrl = `https://musicbrainz.org/ws/2/artist/${bestArtist.id}?fmt=json&inc=genres+tags`;
  const details = await musicBrainzFetchJson(detailsUrl);
  const genreNames = [
    ...(Array.isArray(details?.genres) ? details.genres.map((g) => g?.name) : []),
    ...(Array.isArray(details?.tags) ? details.tags.map((t) => t?.name) : []),
  ];
  const genres = normalizeGenres(genreNames).slice(0, 10);
  musicBrainzArtistGenresCache.set(cacheKey, genres);
  return genres;
}

async function resolveExternalGenres(title, artistName) {
  const cleanTitle = String(title || "").trim();
  const cleanArtist = String(artistName || "").trim();

  if (cleanArtist && cleanTitle) {
    const albumTags = await fetchLastFmAlbumGenres(cleanTitle, cleanArtist);
    if (albumTags.length > 0) return { genres: albumTags, source: "lastfm_album" };
  }

  if (cleanArtist) {
    const artistTags = await fetchLastFmArtistGenres(cleanArtist);
    if (artistTags.length > 0) return { genres: artistTags, source: "lastfm_artist" };
  }

  if (cleanArtist) {
    const mbGenres = await fetchMusicBrainzArtistGenres(cleanArtist);
    if (mbGenres.length > 0) return { genres: mbGenres, source: "musicbrainz_artist" };
  }

  return { genres: [], source: null };
}

async function getArtistNameById(artistId) {
  if (!artistId) return null;
  if (artistNameCache.has(artistId)) return artistNameCache.get(artistId);

  const { data, error } = await supabase
    .from("artists")
    .select("name")
    .eq("id", artistId)
    .maybeSingle();

  if (error) {
    artistNameCache.set(artistId, null);
    return null;
  }

  const name = data?.name ? String(data.name) : null;
  artistNameCache.set(artistId, name);
  return name;
}

function buildAlbumSearchQueries(title, artistName) {
  const cleanTitle = fixMojibake(title).trim();
  const cleanArtist = fixMojibake(artistName).trim();
  if (!cleanTitle) return [];

  const q = [];
  if (cleanArtist) {
    q.push(`album:${cleanTitle} artist:${cleanArtist}`);
    q.push(`"${cleanTitle}" "${cleanArtist}"`);
    q.push(`${cleanTitle} ${cleanArtist}`);
  }
  q.push(`album:${cleanTitle}`);
  q.push(cleanTitle);

  const asciiTitle = removeDiacritics(cleanTitle);
  const asciiArtist = removeDiacritics(cleanArtist);
  if (asciiTitle && asciiTitle !== cleanTitle) {
    if (asciiArtist && asciiArtist !== cleanArtist) {
      q.push(`album:${asciiTitle} artist:${asciiArtist}`);
      q.push(`"${asciiTitle}" "${asciiArtist}"`);
      q.push(`${asciiTitle} ${asciiArtist}`);
    } else if (asciiArtist) {
      q.push(`album:${asciiTitle} artist:${asciiArtist}`);
      q.push(`${asciiTitle} ${asciiArtist}`);
    }
    q.push(`album:${asciiTitle}`);
    q.push(asciiTitle);
  }

  return Array.from(new Set(q.map((x) => x.trim()).filter(Boolean)));
}

function scoreAlbumCandidate(item, wantedTitle, wantedArtist) {
  const albumTitle = normalizeText(item?.name);
  const firstArtist = normalizeText(item?.artists?.[0]?.name);
  const popularity = Number(item?.popularity || 0);
  let score = 0;

  if (albumTitle === wantedTitle) score += 8;
  else if (albumTitle.startsWith(wantedTitle) || wantedTitle.startsWith(albumTitle)) score += 5;
  else if (albumTitle.includes(wantedTitle) || wantedTitle.includes(albumTitle)) score += 3;

  if (wantedArtist) {
    if (firstArtist === wantedArtist) score += 6;
    else if (firstArtist.startsWith(wantedArtist) || wantedArtist.startsWith(firstArtist)) score += 3;
    else if (firstArtist.includes(wantedArtist) || wantedArtist.includes(firstArtist)) score += 2;
  }

  score += popularity * 0.01;
  return score;
}

function normalizeGenreTokens(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((g) => String(g || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort();
}

async function loadArtistGenresMap() {
  const pageSize = 1000;
  let from = 0;
  let loaded = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("artists")
      .select("id, genres")
      .range(from, to)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const normalized = normalizeGenreTokens(row.genres || []);
      if (normalized.length > 0) {
        artistDbGenresCache.set(String(row.id), normalized);
      }
    }

    loaded += rows.length;
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Loaded artist genres map for ${artistDbGenresCache.size} artists (rows scanned: ${loaded})`);
}

async function findSpotifyAlbumIdBySearch(title, artistName) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return null;

  const queries = buildAlbumSearchQueries(cleanTitle, artistName);
  const candidatesById = new Map();
  for (const query of queries) {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`
    );
    if (!res.ok) continue;
    const data = await res.json();
    const items = data?.albums?.items || [];
    for (const item of items) {
      if (item?.id && !candidatesById.has(item.id)) {
        candidatesById.set(item.id, item);
      }
    }
  }

  const items = Array.from(candidatesById.values());
  if (!items.length) return null;

  const wantedTitle = normalizeText(cleanTitle);
  const wantedArtist = normalizeText(artistName);

  let best = null;
  let bestScore = -1;
  for (const item of items) {
    const score = scoreAlbumCandidate(item, wantedTitle, wantedArtist);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return best?.id || items[0]?.id || null;
}

async function findSpotifyArtistGenresByName(artistName) {
  const cleanArtist = String(artistName || "").trim();
  if (!cleanArtist) return [];

  const cacheKey = normalizeText(cleanArtist);
  if (artistGenresByNameCache.has(cacheKey)) {
    return artistGenresByNameCache.get(cacheKey);
  }

  const queries = Array.from(
    new Set(
      [
        `artist:${cleanArtist}`,
        cleanArtist,
        removeDiacritics(cleanArtist) !== cleanArtist ? `artist:${removeDiacritics(cleanArtist)}` : "",
        removeDiacritics(cleanArtist) !== cleanArtist ? removeDiacritics(cleanArtist) : "",
      ].filter(Boolean)
    )
  );

  const candidates = [];
  for (const query of queries) {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=10`
    );
    if (!res.ok) continue;
    const data = await res.json();
    candidates.push(...(data?.artists?.items || []));
  }

  if (!candidates.length) {
    artistGenresByNameCache.set(cacheKey, []);
    return [];
  }

  const wanted = normalizeText(cleanArtist);
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    const name = normalizeText(c?.name);
    let score = 0;
    if (name === wanted) score += 10;
    else if (name.startsWith(wanted) || wanted.startsWith(name)) score += 6;
    else if (name.includes(wanted) || wanted.includes(name)) score += 3;
    score += Number(c?.popularity || 0) * 0.01;

    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }

  const genres = normalizeGenres(best?.genres || []);
  artistGenresByNameCache.set(cacheKey, genres);
  return genres;
}

async function fetchTargetAlbums(maxTargets) {
  const pageSize = 1000;
  let from = 0;
  const targets = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("albums")
      .select("id, title, artist_id, artist_name, spotify_id, genre")
      .range(from, to)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const genreValue = String(row.genre || "").trim();
      if (!genreValue) {
        targets.push(row);
        if (maxTargets > 0 && targets.length >= maxTargets) return targets;
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return targets;
}

function formatProgress({
  processed,
  total,
  updated,
  updatedFromArtistDbGenres,
  updatedFromSpotify,
  updatedFromLastFm,
  updatedFromMusicBrainz,
  resolvedSpotifyId,
  noGenres,
  skipped,
  failed,
}) {
  return (
    `Progress ${processed}/${total} | updated=${updated} ` +
    `(artist_db=${updatedFromArtistDbGenres}, spotify=${updatedFromSpotify}, lastfm=${updatedFromLastFm}, musicbrainz=${updatedFromMusicBrainz}) ` +
    `resolvedSpotifyId=${resolvedSpotifyId} noGenres=${noGenres} skipped=${skipped} failed=${failed}`
  );
}

async function main() {
  const LIMIT = Number(process.env.GENRE_BACKFILL_LIMIT || 0);
  const DRY_RUN = process.env.DRY_RUN === "1";
  const TARGET_ARTIST = String(process.env.GENRE_TARGET_ARTIST || "").trim();
  const TARGET_ALBUM = String(process.env.GENRE_TARGET_ALBUM || "").trim();
  console.log(`Starting genre backfill | DRY_RUN=${DRY_RUN ? "1" : "0"} | LIMIT=${LIMIT}`);
  console.log(
    `Fallback sources | LASTFM_API_KEY=${LASTFM_API_KEY ? "present" : "missing"} | MusicBrainz=enabled`
  );

  await loadArtistGenresMap();
  let targets = await fetchTargetAlbums(LIMIT);
  if (TARGET_ARTIST || TARGET_ALBUM) {
    const normalizedTargetArtist = normalizeText(TARGET_ARTIST);
    const normalizedTargetAlbum = normalizeText(TARGET_ALBUM);
    targets = targets.filter((row) => {
      const rowArtist = normalizeText(row.artist_name || "");
      const rowAlbum = normalizeText(row.title || "");
      const artistOk = !normalizedTargetArtist || rowArtist.includes(normalizedTargetArtist);
      const albumOk = !normalizedTargetAlbum || rowAlbum.includes(normalizedTargetAlbum);
      return artistOk && albumOk;
    });
    console.log(
      `Filtered targets | artist="${TARGET_ARTIST || "-"}" album="${TARGET_ALBUM || "-"}" => ${targets.length}`
    );
  }
  console.log(`Albums with empty genre: ${targets.length}`);

  let updated = 0;
  let updatedFromArtistDbGenres = 0;
  let updatedFromSpotify = 0;
  let updatedFromLastFm = 0;
  let updatedFromMusicBrainz = 0;
  let noGenres = 0;
  let skipped = 0;
  let failed = 0;
  let resolvedSpotifyId = 0;
  const unresolved = [];

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    console.log(`Processing ${i + 1}/${targets.length} | album_id=${row.id}`);
    let spotifyId = String(row.spotify_id || "").trim();
    const artistNameForLookup =
      (row.artist_name && String(row.artist_name).trim()) ||
      (await getArtistNameById(row.artist_id)) ||
      "";

    const artistIdKey = row.artist_id ? String(row.artist_id) : "";
    const artistDbGenres = artistIdKey ? artistDbGenresCache.get(artistIdKey) || [] : [];
    if (artistDbGenres.length > 0) {
      const genreValue = artistDbGenres.join(", ");
      try {
        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from("albums")
            .update({ genre: genreValue })
            .eq("id", row.id);
          if (updateError) throw updateError;
        }
        updated += 1;
        updatedFromArtistDbGenres += 1;
      } catch (err) {
        failed += 1;
        console.warn(`Failed album ${row.id} (artist genres fallback): ${err.message || err}`);
        unresolved.push({
          reason: "artist_db_genres_update_failed",
          album_id: row.id,
          title: row.title || null,
          artist_name: artistNameForLookup || null,
          spotify_id: spotifyId || null,
          error: String(err.message || err),
        });
      }

      if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
        console.log(
          formatProgress({
            processed: i + 1,
            total: targets.length,
            updated,
            updatedFromArtistDbGenres,
            updatedFromSpotify,
            updatedFromLastFm,
            updatedFromMusicBrainz,
            resolvedSpotifyId,
            noGenres,
            skipped,
            failed,
          })
        );
      }
      continue;
    }

    if (!spotifyId) {
      spotifyId = (await findSpotifyAlbumIdBySearch(row.title, artistNameForLookup)) || "";
      if (spotifyId && !DRY_RUN) {
        const { error: spotifyUpdateError } = await supabase
          .from("albums")
          .update({ spotify_id: spotifyId })
          .eq("id", row.id);
        if (spotifyUpdateError) throw spotifyUpdateError;
      }
      if (spotifyId) {
        resolvedSpotifyId += 1;
      }
    }

    if (!spotifyId) {
      try {
        if (artistNameForLookup) {
          const artistOnlyGenres = await findSpotifyArtistGenresByName(artistNameForLookup);
          if (artistOnlyGenres.length > 0) {
            if (!DRY_RUN) {
              const { error: updateError } = await supabase
                .from("albums")
                .update({ genre: artistOnlyGenres.join(", ") })
                .eq("id", row.id);
              if (updateError) throw updateError;
            }
            updated += 1;
            updatedFromSpotify += 1;
            if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
              console.log(
                formatProgress({
                  processed: i + 1,
                  total: targets.length,
                  updated,
                  updatedFromArtistDbGenres,
                  updatedFromSpotify,
                  updatedFromLastFm,
                  updatedFromMusicBrainz,
                  resolvedSpotifyId,
                  noGenres,
                  skipped,
                  failed,
                })
              );
            }
            continue;
          }
        }

        const external = await resolveExternalGenres(row.title, artistNameForLookup);
        if (external.genres.length > 0) {
          if (!DRY_RUN) {
            const { error: updateError } = await supabase
              .from("albums")
              .update({ genre: external.genres.join(", ") })
              .eq("id", row.id);
            if (updateError) throw updateError;
          }
          updated += 1;
          if (String(external.source || "").startsWith("lastfm")) updatedFromLastFm += 1;
          else if (String(external.source || "").startsWith("musicbrainz")) updatedFromMusicBrainz += 1;

          if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
            console.log(
              formatProgress({
                processed: i + 1,
                total: targets.length,
                updated,
                updatedFromArtistDbGenres,
                updatedFromSpotify,
                updatedFromLastFm,
                updatedFromMusicBrainz,
                resolvedSpotifyId,
                noGenres,
                skipped,
                failed,
              })
            );
          }
          continue;
        }
      } catch (err) {
        failed += 1;
        console.warn(`Failed non-spotify fallback for album ${row.id}: ${err.message || err}`);
        unresolved.push({
          reason: "external_genre_lookup_failed",
          album_id: row.id,
          title: row.title || null,
          artist_name: artistNameForLookup || null,
          spotify_id: spotifyId || null,
          error: String(err.message || err),
        });
        if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
          console.log(
            formatProgress({
              processed: i + 1,
              total: targets.length,
              updated,
              updatedFromArtistDbGenres,
              updatedFromSpotify,
              updatedFromLastFm,
              updatedFromMusicBrainz,
              resolvedSpotifyId,
              noGenres,
              skipped,
              failed,
            })
          );
        }
        continue;
      }

      skipped += 1;
      unresolved.push({
        reason: "no_spotify_id_and_no_external_genres",
        album_id: row.id,
        title: row.title || null,
        artist_name: artistNameForLookup || null,
        spotify_id: null,
      });
      if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
        console.log(
          formatProgress({
            processed: i + 1,
            total: targets.length,
            updated,
            updatedFromArtistDbGenres,
            updatedFromSpotify,
            updatedFromLastFm,
            updatedFromMusicBrainz,
            resolvedSpotifyId,
            noGenres,
            skipped,
            failed,
          })
        );
      }
      continue;
    }

    try {
      let genres = await fetchAlbumGenres(spotifyId);
      let source = genres.length > 0 ? "spotify" : null;
      if (genres.length === 0 && artistNameForLookup) {
        const spotifyArtistGenres = await findSpotifyArtistGenresByName(artistNameForLookup);
        if (spotifyArtistGenres.length > 0) {
          genres = spotifyArtistGenres;
          source = "spotify";
        }
      }
      if (genres.length === 0) {
        const external = await resolveExternalGenres(row.title, artistNameForLookup);
        genres = external.genres;
        source = external.source;
      }
      if (genres.length === 0) {
        noGenres += 1;
        unresolved.push({
          reason: "no_genres_from_all_sources",
          album_id: row.id,
          title: row.title || null,
          artist_name: artistNameForLookup || null,
          spotify_id: spotifyId || null,
        });
      } else {
        const genreValue = genres.join(", ");
        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from("albums")
            .update({ genre: genreValue })
            .eq("id", row.id);
          if (updateError) throw updateError;
        }
        updated += 1;
        if (String(source || "").startsWith("lastfm")) updatedFromLastFm += 1;
        else if (String(source || "").startsWith("musicbrainz")) updatedFromMusicBrainz += 1;
        else updatedFromSpotify += 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(`Failed album ${row.id}: ${err.message || err}`);
      unresolved.push({
        reason: "genre_fetch_or_update_failed",
        album_id: row.id,
        title: row.title || null,
        artist_name: artistNameForLookup || null,
        spotify_id: spotifyId || null,
        error: String(err.message || err),
      });
    }

    if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
      console.log(
        formatProgress({
          processed: i + 1,
          total: targets.length,
          updated,
          updatedFromArtistDbGenres,
          updatedFromSpotify,
          updatedFromLastFm,
          updatedFromMusicBrainz,
          resolvedSpotifyId,
          noGenres,
          skipped,
          failed,
        })
      );
    }
  }

  console.log("Done.");
  console.log({
    totalTargets: targets.length,
    updated,
    updatedFromArtistDbGenres,
    updatedFromSpotify,
    updatedFromLastFm,
    updatedFromMusicBrainz,
    resolvedSpotifyId,
    noGenres,
    skipped,
    failed,
    dryRun: DRY_RUN,
  });

  const unresolvedPath = path.resolve(__dirname, "unresolved_album_genres.json");
  fs.writeFileSync(unresolvedPath, JSON.stringify(unresolved, null, 2), "utf8");
  console.log(`Saved unresolved report: ${unresolvedPath} (${unresolved.length} rows)`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
