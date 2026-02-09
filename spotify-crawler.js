// spotify-crawler.js
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local');
  process.exit(1);
}

let cachedToken = null;
let cachedExpiresAt = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiresAt) return cachedToken;

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
  cachedToken = data.access_token;
  cachedExpiresAt = now + (data.expires_in || 3600) * 1000 - 10_000;
  return cachedToken;
}

async function spotifyFetch(url) {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    cachedToken = null;
    const token2 = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token2}` } });
  }
  return res;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const res = await spotifyFetch(url);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') || '1');
      await sleep((retryAfter + 0.5) * 1000);
      continue;
    }
    return res;
  }
  return spotifyFetch(url);
}

async function crawlSpotify() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const results = [];
  const seen = new Set();

  const MAX_OFFSET = Number(process.env.CRAWL_MAX_OFFSET || 1000);
  const LIMIT = 50;
  const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 6);

  console.log('Start crawl Spotify...');
  let total = 0;

  const tasks = [];

  for (const letter of letters) {
    console.log(`\nLetter: ${letter}`);
    for (let offset = 0; offset < MAX_OFFSET; offset += LIMIT) {
      const url = `https://api.spotify.com/v1/search?q=${letter}&type=album&limit=${LIMIT}&offset=${offset}`;
      tasks.push(async () => {
        const res = await fetchWithRetry(url);
        const data = await res.json();

        if (data.error) {
          console.error(`API error: ${data.error.message}`);
          return;
        }

        const items = data.albums?.items || [];
        if (!items.length) return;

        const mapped = items.map((a) => ({
          id: a.id,
          title: a.name,
          artist: a.artists?.[0]?.name,
          artist_id: a.artists?.[0]?.id,
          year: a.release_date ? a.release_date.split('-')[0] : null,
          cover_url: a.images?.[0]?.url,
          spotify_url: a.external_urls?.spotify,
        }));

        for (const m of mapped) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          results.push(m);
          total += 1;
        }
      });
    }
  }

  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      await tasks[i]();
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync('spotify_albums.json', JSON.stringify(results, null, 2));
  console.log(`\nDone. Saved ${total} albums to spotify_albums.json`);
}

crawlSpotify().catch((err) => console.error('Error:', err.message));
