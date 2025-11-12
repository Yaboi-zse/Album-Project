// pages/api/spotify/tracks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSpotifyAccessToken } from "../../../src/lib/spotifyToken";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { album_id } = req.query;

  if (!album_id || typeof album_id !== "string") {
    return res.status(400).json({ error: "Missing album_id parameter" });
  }

  try {
    const accessToken = await getSpotifyAccessToken();

    const spotifyRes = await fetch(`https://api.spotify.com/v1/albums/${album_id}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!spotifyRes.ok) {
      const errText = await spotifyRes.text();
      console.error("Spotify error:", errText);
      return res.status(spotifyRes.status).json({ error: errText });
    }

    const data = await spotifyRes.json();

    const tracks = (data.items || []).map((t: any) => ({
      id: t.id,
      title: t.name,
      duration: Math.floor(t.duration_ms / 1000),
      spotify_url: t.external_urls?.spotify || null,
      preview_url: t.preview_url || null,
      track_number: t.track_number,
    }));

    return res.status(200).json(tracks);
  } catch (err: any) {
    console.error("💥 /api/spotify/tracks error:", err);
    return res.status(500).json({ error: "internal", details: err.message });
  }
}
