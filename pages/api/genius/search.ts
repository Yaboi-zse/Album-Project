import type { NextApiRequest, NextApiResponse } from "next";

const GENIUS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { album, artist, title } = req.query;

  // 🧠 Wyszukiwanie na podstawie tytułu + artysty
  const query = title
    ? `${title} ${artist || ""}`
    : album
    ? `${album} ${artist || ""}`
    : null;

  if (!query) {
    return res.status(400).json({ error: "Missing query (title or album + artist)" });
  }

  try {
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${GENIUS_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!data.response?.hits?.length) {
      return res.status(404).json({ error: "No lyrics found for this song" });
    }

    const hit = data.response.hits[0].result;

    res.status(200).json({
      title: hit.full_title,
      artist: hit.primary_artist?.name,
      url: hit.url,
      image: hit.song_art_image_thumbnail_url,
    });
  } catch (error: any) {
    console.error("❌ Genius API error:", error);
    res.status(500).json({ error: "Genius API request failed", details: error.message });
  }
}
