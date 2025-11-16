// pages/api/lastfm/album.ts
import type { NextApiRequest, NextApiResponse } from "next";

const API_KEY = process.env.LASTFM_API_KEY;
const API_SECRET = process.env.LASTFM_API_SECRET;

/**
 * Czyści HTML + śmieci Last.fm
 */
function cleanLastFmText(html?: string | null) {
  if (!html) return "";

  let text = html;

  // 1. Usuń linki (<a>) ale zostaw tekst w środku
  text = text.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");

  // 2. Zamiana <br> i </p> na nowe linie
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");

  // 3. Usuń wszystkie tagi HTML
  text = text.replace(/<\/?[^>]+(>|$)/g, "");

  // 4. Usuń sygnatury Last.fm
  text = text.replace(/Read more on Last\.fm[\s\S]*/gi, "");
  text = text.replace(/User-contributed text[\s\S]*/gi, "");

  // 5. Usuń nadmiarowe białe znaki
  text = text.replace(/\n{3,}/g, "\n\n"); // max 2 nowe linie pod rząd
  text = text.replace(/[ \t]+/g, " ");

  // 6. Trim
  return text.trim();
}

/**
 * Pobiera opis albumu z Last.fm
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { title, artist, target_lang = "pl" } = req.query;

  if (!title || !artist) {
    return res.status(400).json({ error: "Missing title or artist" });
  }

  try {
    const lastfmUrl = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${API_KEY}&artist=${encodeURIComponent(
      String(artist)
    )}&album=${encodeURIComponent(String(title))}&format=json`;

    const resp = await fetch(lastfmUrl);
    const json = await resp.json();

    const rawHtml: string | undefined = json?.album?.wiki?.content;
    const original = cleanLastFmText(rawHtml);

    // Brak oryginalnego opisu?
    if (!original) {
      return res.status(200).json({
        description_original: null,
        description_translated: null,
      });
    }

    // --- TŁUMACZENIE ---
    let translated: string | null = null;

    try {
      const translateRes = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: original,
          source: "en",
          target: target_lang,
          format: "text",
        }),
      });

      if (translateRes.ok) {
        const t = await translateRes.json();
        translated = cleanLastFmText(t?.translatedText || null);
      }
    } catch (err) {
      console.warn("Translation failed:", err);
      translated = null;
    }

    return res.status(200).json({
      description_original: original || null,
      description_translated: translated || null,
    });
  } catch (err) {
    console.error("LastFM API error:", err);
    return res.status(500).json({ error: "LastFM fetch failed" });
  }
}
