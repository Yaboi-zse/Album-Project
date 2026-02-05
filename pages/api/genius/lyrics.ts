import type { NextApiRequest, NextApiResponse } from "next";
// Tekstowo Unofficial API
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TekstowoAPI = require("tekstowo-api");

const normalizeForLyrics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'\"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const simplifyTitle = (value: string) =>
  value
    .replace(/\s*\((feat\.|ft\.).*?\)/gi, "")
    .replace(/\s*-\s*.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const formatLyrics = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<strong>\s*([^<]+?)\s*<\/strong>/gi, "\n[$1]\n")
    .replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const parts = inner.split(":");
      const rawLabel = parts[0].replace(/\s+/g, " ").trim();
      const label = rawLabel.replace(/\s*\d+\s*$/i, "").trim();
      const rest = parts.slice(1).join(":").trim();
      if (!label) {
        return `[${inner.trim()}]`;
      }
      return `[${label}${rest ? `: ${rest}` : ""}]`;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

async function tryLyricsOvh(artist: string, title: string, timeoutMs = 5000) {
  if (!artist || !title) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const lyrics = data?.lyrics ? String(data.lyrics).trim() : "";
    return lyrics.length ? lyrics : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryTekstowoGetLyrics(api: any, artist: string, title: string) {
  if (!artist || !title) return null;
  try {
    const res = await api.getLyrics(artist, title);
    if (!res) return null;
    const lyrics = res.original || res.translated || null;
    return lyrics ? String(lyrics) : null;
  } catch {
    return null;
  }
}

async function tryTekstowoSearch(api: any, artist: string, title: string) {
  if (!artist || !title) return null;
  try {
    const query = `${artist} ${title}`.trim();
    const results = await api.search(query, { onlySongs: true });
    const entries = results && typeof results === "object" ? Object.entries(results) : [];
    if (entries.length === 0) return null;

    const artistNorm = normalizeForLyrics(artist.toLowerCase());
    const titleNorm = normalizeForLyrics(title.toLowerCase());
    const exact = entries.find(([name]) => {
      const n = normalizeForLyrics(String(name).toLowerCase());
      return n.includes(artistNorm) && n.includes(titleNorm);
    });

    const picked = (exact ?? entries[0]) as [string, string];
    const songId = picked?.[1];
    if (!songId) return null;

    const lyricsRes = await api.extractLyrics(songId, { withMetadata: false, withVideoId: false });
    const lyrics = lyricsRes?.original || lyricsRes?.translated || null;
    return lyrics ? String(lyrics) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { title, artist } = req.query;
  const titleParam = typeof title === "string" ? title.trim() : "";
  const artistParam = typeof artist === "string" ? artist.trim() : "";

  if (!titleParam || !artistParam) {
    return res.status(400).json({ error: "Missing title or artist" });
  }

  try {
    const ovhLyrics =
      (await tryLyricsOvh(artistParam, titleParam, 3500)) ||
      (await tryLyricsOvh(artistParam, simplifyTitle(titleParam), 3500)) ||
      (await tryLyricsOvh(titleParam, artistParam, 2500));
    if (ovhLyrics) {
      return res.status(200).json({
        lyrics: formatLyrics(ovhLyrics),
        source: "lyrics.ovh",
        query: `${artistParam} ${titleParam}`,
      });
    }

    const fetchImpl = (url: string, options?: RequestInit) =>
      fetch(url, {
        ...options,
        headers: {
          ...(options?.headers || {}),
          "User-Agent": "Mozilla/5.0",
        },
      });
    const api = new TekstowoAPI(fetchImpl, 0);
    const normalizedArtist = normalizeForLyrics(artistParam);
    const normalizedTitle = normalizeForLyrics(titleParam);
    const simplifiedTitle = simplifyTitle(titleParam);
    const normalizedSimplifiedTitle = normalizeForLyrics(simplifiedTitle);

    const pairs: Array<[string, string]> = [
      [artistParam, titleParam],
      [normalizedArtist, normalizedTitle],
      [normalizedArtist, titleParam],
      [artistParam, normalizedTitle],
      [artistParam, simplifiedTitle],
      [normalizedArtist, normalizedSimplifiedTitle],
    ];

    const getLyricsPromises = pairs.map(([a, t]) =>
      withTimeout(tryTekstowoGetLyrics(api, a, t), 8000).catch(() => null)
    );
    const getLyricsTask = Promise.any(
      getLyricsPromises.map((p) =>
        p.then((value) => (value ? value : Promise.reject(new Error("empty"))))
      )
    ).catch(() => null);

    const searchPromises = [
      withTimeout(tryTekstowoSearch(api, artistParam, titleParam), 8000).catch(() => null),
      withTimeout(tryTekstowoSearch(api, normalizedArtist, normalizedTitle), 8000).catch(() => null),
      withTimeout(tryTekstowoSearch(api, artistParam, simplifiedTitle), 8000).catch(() => null),
      withTimeout(tryTekstowoSearch(api, normalizedArtist, normalizedSimplifiedTitle), 8000).catch(
        () => null
      ),
      withTimeout(tryTekstowoSearch(api, titleParam, artistParam), 8000).catch(() => null),
    ];
    const searchTask = Promise.any(
      searchPromises.map((p) =>
        p.then((value) => (value ? value : Promise.reject(new Error("empty"))))
      )
    ).catch(() => null);

    const [getLyricsResult, searchResult] = await Promise.all([getLyricsTask, searchTask]);
    const tekstowoLyrics = getLyricsResult || searchResult;
    if (tekstowoLyrics) {
      return res.status(200).json({
        lyrics: formatLyrics(tekstowoLyrics),
        source: "tekstowo",
        query: `${artistParam} ${titleParam}`,
      });
    }

    return res.status(404).json({ error: "Lyrics not found", query: `${artistParam} ${titleParam}` });
  } catch (error: any) {
    return res.status(500).json({
      error: "Lyrics API error",
      message: error?.message ?? String(error),
    });
  }
}
