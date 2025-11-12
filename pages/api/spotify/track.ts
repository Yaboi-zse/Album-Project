// pages/api/spotify/track.ts
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
