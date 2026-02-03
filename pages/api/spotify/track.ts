// pages/api/spotify/track.ts
<<<<<<< HEAD
import type { NextApiRequest, NextApiResponse } from "next";
import { getSpotifyAccessToken } from "../../../src/lib/spotifyToken";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { track_id } = req.query;

  if (!track_id || typeof track_id !== "string") {
    return res.status(400).json({ error: "Missing track_id parameter" });
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyRes = await fetch(`https://api.spotify.com/v1/tracks/${track_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!spotifyRes.ok) {
      const errText = await spotifyRes.text();
      console.error("Spotify track error:", errText);
      return res.status(spotifyRes.status).json({ error: errText });
    }

    const t = await spotifyRes.json();

    const track = {
      id: t.id,
      title: t.name,
      duration: Math.floor(t.duration_ms / 1000),
      spotify_url: t.external_urls?.spotify || null,
      preview_url: t.preview_url || null,
      track_number: t.track_number,
      album: {
        id: t.album?.id || null,
        title: t.album?.name || null,
        cover_url: t.album?.images?.[0]?.url || null,
      },
      artist: t.artists?.[0]?.name || null,
    };

    return res.status(200).json(track);
  } catch (err: any) {
    console.error("💥 /api/spotify/track error:", err);
    return res.status(500).json({ error: "internal", details: err.message });
  }
}
=======
import type { NextApiRequest, NextApiResponse } from 'next';

// Tymczasowa funkcja getSpotifyToken
async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { track_id } = req.query;

  if (!track_id || typeof track_id !== 'string') {
    return res.status(400).json({ error: 'Missing track_id parameter' });
  }

  try {
    const token = await getSpotifyToken();
    console.log("🔧 Fetching Spotify track:", track_id);
    
    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${track_id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Spotify API error:", response.status, errorText);
      return res.status(response.status).json({ 
        error: `Spotify API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log("✅ Spotify track data received");
    
    // Format danych zgodny z oczekiwaniami
    const formattedTrack = {
      id: data.id,
      name: data.name,
      title: data.name,
      duration_ms: data.duration_ms,
      preview_url: data.preview_url,
      track_number: data.track_number,
      external_urls: data.external_urls,
      spotify_url: data.external_urls?.spotify,
      artists: data.artists || [],
      album: data.album || null,
    };

    res.status(200).json(formattedTrack);
  } catch (error: any) {
    console.error('❌ Error fetching Spotify track:', error);
    res.status(500).json({ 
      error: 'Failed to fetch track from Spotify',
      message: error.message 
    });
  }
}
>>>>>>> 3a6798f ('')
