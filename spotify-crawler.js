// spotify-crawler.js
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('❌ Brakuje SPOTIFY_CLIENT_ID lub SPOTIFY_CLIENT_SECRET w .env.local');
  process.exit(1);
}

async function getToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function crawlSpotify() {
  const token = await getToken();
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const results = [];

  console.log('🚀 Start crawl Spotify...');
  let total = 0;

  for (const letter of letters) {
    console.log(`\n🔤 Litera: ${letter}`);
    for (let offset = 0; offset < 200; offset += 50) {
      const url = `https://api.spotify.com/v1/search?q=${letter}&type=album&limit=50&offset=${offset}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      // Obsługa błędów Spotify API
      if (data.error) {
        console.error(`❌ Błąd API: ${data.error.message}`);
        break;
      }

      const items = data.albums?.items || [];
      if (!items.length) {
        console.log(`⚠️ Brak wyników (offset ${offset})`);
        break;
      }

      const mapped = items.map((a) => ({
        id: a.id,
        title: a.name,
        artist: a.artists?.[0]?.name,
        artist_id: a.artists?.[0]?.id,
        year: a.release_date ? a.release_date.split('-')[0] : null,
        cover_url: a.images?.[0]?.url,
        spotify_url: a.external_urls?.spotify,
      }));

      results.push(...mapped);
      total += mapped.length;

      console.log(`✅ Offset ${offset}: pobrano ${mapped.length} albumów`);
      await new Promise((r) => setTimeout(r, 400)); // mały delay, by nie zbanować
    }
  }

  fs.writeFileSync('spotify_albums.json', JSON.stringify(results, null, 2));
  console.log(`\n🎉 Zakończono. Zapisano ${total} albumów do spotify_albums.json`);
}

crawlSpotify().catch((err) => console.error('❌ Błąd:', err.message));
