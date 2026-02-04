import type { NextApiRequest, NextApiResponse } from "next";

const GENIUS_API = "https://api.genius.com";

async function tryLyricsOvh(artist: string, title: string) {
  if (!artist || !title) return null;
  const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const response = await fetch(lyricsUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.lyrics ? String(data.lyrics) : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { title, artist } = req.query;

  const titleParam = typeof title === "string" ? title.trim() : "";
  const artistParam = typeof artist === "string" ? artist.trim() : "";

  if (!titleParam || !artistParam) {
    return res.status(400).json({ error: "Missing title or artist" });
  }

  try {
    const lyrics = await tryLyricsOvh(artistParam, titleParam);
    if (!lyrics) {
      return res.status(404).json({ error: "Lyrics not found", query: `${artistParam} ${titleParam}` });
    }

    return res.status(200).json({
      lyrics,
      source: "lyrics.ovh",
      query: `${artistParam} ${titleParam}`,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Lyrics API error",
      message: error?.message ?? String(error),
    });
  }
}
