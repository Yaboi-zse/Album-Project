// import-genres.js
// node import-genres.js [--dry-run] [--delay=ms]
// requires Node 18+ (global fetch) or polyfill
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";


const DRY = process.argv.includes("--dry-run");
const delayArg = process.argv.find(a => a.startsWith("--delay="));
const DELAY_MS = delayArg ? Number(delayArg.split("=")[1]) : 600; // domyślnie 600ms między requestami

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY muszą być ustawione w środowisku.");
  process.exit(1);
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET muszą być ustawione w środowisku.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getSpotifyToken() {
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
    const text = await res.text();
    throw new Error("Spotify token error: " + res.status + " - " + text);
  }
  const j = await res.json();
  return j.access_token;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// sanitize strings for search
function q(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function main() {
  console.log(`START import genres ${DRY ? "(DRY RUN)" : ""} — delay ${DELAY_MS}ms`);

  // 1) pobierz albumy gdzie genre jest NULL lub puste
  const { data: albums, error } = await supabase
    .from("albums")
    .select("id, title, cover_url, artist_id, artists(name)")
    .or("genre.is.null,genre.eq.''")
    .limit(1000); // dopasuj limit jeśli masz więcej — można paginować

  if (error) {
    console.error("Błąd pobierania albumów:", error);
    process.exit(1);
  }

  if (!albums || albums.length === 0) {
    console.log("Brak albumów bez gatunku. Nic do zrobienia.");
    return;
  }

  console.log(`Znaleziono ${albums.length} albumów bez gatunku — zaczynam import...`);

  const token = await getSpotifyToken();
  console.log("Uzyskano token Spotify");

  let updated = 0;
  let skipped = 0;

  for (const alb of albums) {
    const title = q(alb.title);
    // attempt to get artist name from joined relation if available
    const artistName = alb.artists?.name || alb.artist_name || "";

    // Build a focused search: album:"title" artist:"artist"
    const queryParts = [];
    if (title) queryParts.push(`album:${title}`);
    if (artistName) queryParts.push(`artist:${artistName}`);
    const query = queryParts.length ? queryParts.join(" ") : title || artistName;

    try {
      // Search album
      const sres = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (sres.status === 401) {
        // token expired/invalid -> get new token and retry once
        console.log("Spotify token expired, pobieram nowy token...");
        const newToken = await getSpotifyToken();
        token = newToken; // eslint-disable-line no-param-reassign
        // retry
      }

      const sjson = await sres.json();

      const foundAlbum = sjson.albums?.items?.[0];
      if (!foundAlbum) {
        console.log(`> Nie znaleziono na Spotify: "${alb.title}" / "${artistName}" (id: ${alb.id}) — pomijam`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      // We take first artist from found album
      const spotifyArtist = foundAlbum.artists?.[0];
      if (!spotifyArtist?.id) {
        console.log(`> Album znaleziony, ale brak artysty (id: ${alb.id}) — pomijam`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      // Fetch artist to get genres
      const ares = await fetch(`https://api.spotify.com/v1/artists/${spotifyArtist.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const ajson = await ares.json();
      const genres = ajson.genres || [];

      if (!genres || genres.length === 0) {
        console.log(`> Brak gatunków na Spotify dla artysty ${spotifyArtist.name} (album id ${alb.id}) — pomijam`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      // join genres into a single string (np. "rock, indie pop")
      const genreValue = genres.join(", ");

      console.log(`> ${alb.id}: ustawiam genre = "${genreValue}" (znaleziono ${genres.length})`);

      if (!DRY) {
        const { error: upErr } = await supabase
          .from("albums")
          .update({ genre: genreValue })
          .eq("id", alb.id);

        if (upErr) {
          console.error("  Błąd zapisu:", upErr);
        } else {
          updated++;
        }
      } else {
        updated++;
      }

      // delay to avoid hitting rate limits
      await sleep(DELAY_MS);
    } catch (err) {
      console.error("Błąd podczas przetwarzania albumu", alb.id, err);
      // w razie błędu poczekaj chwilę i kontynuuj
      await sleep(2000);
    }
  }

  console.log(`Koniec. zaktualizowane: ${updated}, pominięte: ${skipped}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
