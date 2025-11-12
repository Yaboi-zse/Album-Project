// pages/api/spotify/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSpotifyAccessToken } from "../../../src/lib/spotifyToken";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { album, artist } = req.query;

  if (!album || !artist) {
    return res.status(400).json({ error: "Brak wymaganych parametrów (album, artist)" });
  }

  try {
    // Pobierz token dostępu do Spotify
    const accessToken = await getSpotifyAccessToken();

    // ✅ Poprawione zapytanie — Spotify wymaga parametru `q=`
    const q = `album:${album} artist:${artist}`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=1`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Spotify search error:", errorText);
      return res
        .status(response.status)
        .json({ error: "Spotify search failed", details: errorText });
    }

    const data = await response.json();

    if (!data.albums?.items?.length) {
      return res.status(404).json({ error: "Nie znaleziono albumu na Spotify" });
    }

    const albumItem = data.albums.items[0];
    return res.status(200).json({
      spotify_id: albumItem.id,
      name: albumItem.name,
      artist: albumItem.artists?.[0]?.name,
      cover_url: albumItem.images?.[0]?.url || null,
      spotify_url: albumItem.external_urls?.spotify,
    });
  } catch (err: any) {
    console.error("Błąd w /api/spotify/search:", err);
    return res.status(500).json({ error: "internal", details: err.message });
  }
}
