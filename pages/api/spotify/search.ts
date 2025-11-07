// pages/api/spotify/search.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Minimalne typy dla Spotify API
interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  release_date?: string;
  total_tracks?: number;
  images?: SpotifyImage[];
  external_urls?: { spotify?: string };
  label?: string;
}

interface SpotifySearchResponse {
  albums: {
    items: SpotifyAlbum[];
  };
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

// 🔹 Funkcja do pobrania tokena aplikacyjnego Spotify
async function getClientCredentialsToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Spotify token fetch failed: ${resp.status} ${text}`);
  }

  // 👇 Jawne rzutowanie typu
  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Missing access_token in Spotify response');

  return data.access_token;
}

// 🔹 Główny handler Next.js
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'Missing query param q' });

    const token = await getClientCredentialsToken();
    const url = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(q)}&type=album&limit=12`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt || 'Spotify search failed' });
    }

    // 👇 Tutaj najważniejsze: rzutowanie typu `SpotifySearchResponse`
    const data = (await r.json()) as SpotifySearchResponse;

    const albums = data.albums?.items?.map((a) => ({
      id: a.id,
      name: a.name,
      artists: a.artists?.map((ar) => ({ id: ar.id, name: ar.name })) || [],
      release_date: a.release_date,
      total_tracks: a.total_tracks,
      images: a.images,
      spotify_url: a.external_urls?.spotify,
      label: a.label,
    }));

    return res.status(200).json(albums || []);
  } catch (err: any) {
    console.error('❌ Spotify search error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
