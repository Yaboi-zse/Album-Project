/* eslint-disable no-console */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in env.");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE URL/KEY in env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let spotifyToken = null;
let spotifyTokenExp = 0;

async function getSpotifyToken() {
  const now = Date.now();
  if (spotifyToken && now < spotifyTokenExp) return spotifyToken;

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify token error: ${t}`);
  }
  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExp = now + data.expires_in * 1000 - 10_000;
  return spotifyToken;
}

async function spotifyFetch(url) {
  const token = await getSpotifyToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    spotifyToken = null;
    const token2 = await getSpotifyToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token2}` } });
  }
  return res;
}

async function fetchAlbumDetails(albumId) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${albumId}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchArtistDetails(artistId) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/artists/${artistId}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchAlbumTracks(albumId) {
  const tracks = [];
  let offset = 0;
  const pageSize = 50;
  while (true) {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=${pageSize}&offset=${offset}`
    );
    if (!res.ok) break;
    const data = await res.json();
    const items = data?.items || [];
    tracks.push(...items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return tracks;
}

async function getOrCreateArtist(artist) {
  const name = artist?.name?.trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from("artists")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const details = await fetchArtistDetails(artist.id);
  const imageUrl = details?.images?.[0]?.url ?? null;
  const { data: inserted, error } = await supabase
    .from("artists")
    .insert({ name, image_url: imageUrl })
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("Artist insert error:", error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function upsertAlbum(album, artistId) {
  const spotifyId = album.id;
  const coverUrl = album.images?.[0]?.url ?? null;
  const year = album.release_date ? Number(album.release_date.slice(0, 4)) : null;
  const artistName = album.artists?.[0]?.name ?? null;

  const { data: existing } = await supabase
    .from("albums")
    .select("id")
    .eq("spotify_id", spotifyId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("albums")
      .update({
        title: album.name,
        year,
        cover_url: coverUrl,
        artist_id: artistId,
        artist_name: artistName,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("albums")
    .insert({
      title: album.name,
      year,
      genre: null,
      cover_url: coverUrl,
      artist_id: artistId,
      artist_name: artistName,
      spotify_id: spotifyId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Album insert error:", error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function upsertTracks(albumId, tracks, artistName) {
  for (const t of tracks) {
    const spotifyId = t.id;
    const { data: existing } = await supabase
      .from("tracks")
      .select("id")
      .eq("spotify_id", spotifyId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("tracks")
        .update({
          title: t.name,
          duration: t.duration_ms ? Math.floor(t.duration_ms / 1000) : null,
          track_number: t.track_number,
          spotify_url: t.external_urls?.spotify ?? null,
          preview_url: t.preview_url ?? null,
          artist_name: artistName,
          album_id: albumId,
        })
        .eq("id", existing.id);
      continue;
    }

    await supabase.from("tracks").insert({
      spotify_id: spotifyId,
      title: t.name,
      duration: t.duration_ms ? Math.floor(t.duration_ms / 1000) : null,
      track_number: t.track_number,
      spotify_url: t.external_urls?.spotify ?? null,
      preview_url: t.preview_url ?? null,
      artist_name: artistName,
      album_id: albumId,
    });
  }
}

async function main() {
  const PATH = process.env.SPOTIFY_JSON_PATH || "spotify_albums.json";
  const LIMIT = Number(process.env.IMPORT_LIMIT || 1000);
  if (!fs.existsSync(PATH)) {
    throw new Error(`Missing file: ${PATH}`);
  }

  const raw = fs.readFileSync(PATH, "utf8");
  const items = JSON.parse(raw);
  const albumIds = items.map((a) => a.id).filter(Boolean).slice(0, LIMIT);

  console.log(`Importing albums from ${PATH}: ${albumIds.length}`);

  for (let i = 0; i < albumIds.length; i++) {
    const albumId = albumIds[i];
    const album = await fetchAlbumDetails(albumId);
    if (!album) continue;

    const primaryArtist = album.artists?.[0] ?? null;
    const artistId = await getOrCreateArtist(primaryArtist);
    const dbAlbumId = await upsertAlbum(album, artistId);
    if (!dbAlbumId) continue;

    const albumTracks = await fetchAlbumTracks(albumId);
    await upsertTracks(dbAlbumId, albumTracks, primaryArtist?.name ?? null);

    if ((i + 1) % 25 === 0) {
      console.log(`Processed ${i + 1}/${albumIds.length}`);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
