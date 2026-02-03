import type { NextApiRequest, NextApiResponse } from "next";

const GENIUS_API = "https://api.genius.com";

function decodeHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

function extractLyricsFromHtml(html: string) {
  const blocks = Array.from(
    html.matchAll(/<div[^>]*data-lyrics-container=['"]true['"][^>]*>([\s\S]*?)<\/div>/g)
  ).map((m) => m[1]);

  let raw = "";

  if (blocks.length > 0) {
    raw = blocks.join("\n");
  } else {
    const legacy = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/);
    raw = legacy ? legacy[1] : "";
  }

  if (!raw) return null;

  const decoded = decodeHtml(raw);
  const text = stripTags(decoded)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length ? text : null;
}

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
  const { q, title, artist } = req.query;

  const titleParam = typeof title === "string" ? title : "";
  const artistParam = typeof artist === "string" ? artist : "";
  const qParam = typeof q === "string" ? q : "";

  const searchQuery = [artistParam, titleParam].filter(Boolean).join(" ") || qParam;

  if (!searchQuery) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Missing GENIUS_ACCESS_TOKEN" });
  }

  try {
    const searchRes = await fetch(`${GENIUS_API}/search?q=${encodeURIComponent(searchQuery)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!searchRes.ok) {
      const fallback = await tryLyricsOvh(artistParam, titleParam);
      if (fallback) {
        return res.status(200).json({
          lyrics: fallback,
          source: "lyrics.ovh",
          query: searchQuery,
        });
      }
      const text = await searchRes.text();
      return res.status(searchRes.status).json({
        error: "Genius search failed",
        details: text,
      });
    }

    const searchJson = await searchRes.json();
    const hits = searchJson?.response?.hits ?? [];
    const songHit = hits.find((h: any) => h.type === "song") ?? hits[0];

    if (!songHit?.result?.url) {
      const fallback = await tryLyricsOvh(artistParam, titleParam);
      if (fallback) {
        return res.status(200).json({
          lyrics: fallback,
          source: "lyrics.ovh",
          query: searchQuery,
        });
      }
      return res.status(404).json({ error: "No Genius results", query: searchQuery });
    }

    const songUrl = songHit.result.url as string;

    const pageRes = await fetch(songUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9,pl;q=0.8",
      },
    });

    if (!pageRes.ok) {
      const fallback = await tryLyricsOvh(artistParam, titleParam);
      if (fallback) {
        return res.status(200).json({
          lyrics: fallback,
          source: "lyrics.ovh",
          query: searchQuery,
        });
      }
      const text = await pageRes.text();
      return res.status(pageRes.status).json({
        error: "Failed to fetch Genius song page",
        details: text,
      });
    }

    const html = await pageRes.text();
    const lyrics = extractLyricsFromHtml(html);

    if (!lyrics) {
      const fallback = await tryLyricsOvh(artistParam, titleParam);
      if (fallback) {
        return res.status(200).json({
          lyrics: fallback,
          source: "lyrics.ovh",
          query: searchQuery,
        });
      }
      return res.status(404).json({ error: "Lyrics not found", query: searchQuery });
    }

    return res.status(200).json({
      lyrics,
      source: "genius",
      query: searchQuery,
      song: {
        id: songHit.result.id,
        title: songHit.result.title,
        full_title: songHit.result.full_title,
        url: songUrl,
        primary_artist: songHit.result.primary_artist?.name,
      },
    });
  } catch (error: any) {
    const fallback = await tryLyricsOvh(artistParam, titleParam);
    if (fallback) {
      return res.status(200).json({
        lyrics: fallback,
        source: "lyrics.ovh",
        query: searchQuery,
      });
    }

    return res.status(500).json({
      error: "Lyrics API error",
      message: error?.message ?? String(error),
    });
  }
}
