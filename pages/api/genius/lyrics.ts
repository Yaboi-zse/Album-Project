export const config = {
  runtime: "nodejs",
};

import type { NextApiRequest, NextApiResponse } from "next";
import { chromium } from "playwright";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing q parameter" });
  }

  const TOKEN = process.env.GENIUS_ACCESS_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: "Missing GENIUS_ACCESS_TOKEN" });
  }

  try {
    // 1) Search on Genius API
    const searchRes = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const searchJson = await searchRes.json();

    if (!searchJson?.response?.hits?.length) {
      return res.status(404).json({ lyrics: null, note: "No Genius search results" });
    }

    const song = searchJson.response.hits[0].result;
    const songUrl = song.url;

    // 2) Launch Playwright (NO networkidle, NO waiting forever)
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"]
    });

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    // Load page with reduced timeout and without "networkidle"
    await page.goto(songUrl, { timeout: 15000, waitUntil: "domcontentloaded" });

    // Wait for lyrics container (new Genius layout)
    await page.waitForSelector("[data-lyrics-container]", { timeout: 10000 });

    const lyrics = await page.$$eval("[data-lyrics-container]", (els) =>
    els
        .map((el) => {
        const htmlEl = el as HTMLElement;
        return htmlEl.innerText || htmlEl.textContent || "";
        })
        .join("\n\n")
    );



    await browser.close();

    if (!lyrics) {
      return res.status(404).json({ lyrics: null, note: "Lyrics not found in HTML" });
    }

    return res.status(200).json({
      lyrics,
      genius_url: songUrl,
      title: song.full_title
    });

  } catch (err: any) {
    console.error("GENIUS SCRAPER ERROR:", err);
    return res.status(500).json({
      lyrics: null,
      error: err.message
    });
  }
}
