// pages/api/spotify/track.ts
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
