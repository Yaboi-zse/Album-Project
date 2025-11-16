import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../src/lib/supabaseClient";

function extractSpotifyAlbumId(s?: string | null) {
  if (!s) return null;
  const m1 = s.match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/i);
  if (m1) return m1[1];
  const m2 = s.match(/spotify:album:([A-Za-z0-9]+)/i);
  if (m2) return m2[1];
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { data: albums, error } = await supabase.from("albums").select("*");

  if (error || !albums) {
    return res.status(500).json({ error: "Błąd pobierania albumów" });
  }

  const results = [];

  for (const album of albums) {
    let updated: any = {};

    // 1. Wyciąganie spotify_id z linku w description
    if (!album.spotify_id) {
      const fromDesc = extractSpotifyAlbumId(album.description);
      if (fromDesc) {
        updated.spotify_id = fromDesc;
      }
    }

    // 2. Pobieranie opisu z Last.fm (jeśli description to link albo jest puste)
    const descLooksLikeUrl =
      typeof album.description === "string" &&
      /^(https?:\/\/|www\.)[^\s]+$/i.test(album.description);

    const needDescription =
      descLooksLikeUrl || !album.description_original || !album.description;

    if (needDescription && album.title) {
      try {
        const artist = album.artist_name ?? "";

        const lastfmRes = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/lastfm/album?title=${encodeURIComponent(
            album.title
          )}&artist=${encodeURIComponent(artist)}&target_lang=pl`
        );

        if (lastfmRes.ok) {
          const j = await lastfmRes.json();
          const raw = j?.description_original?.trim();
          const translated = (j?.description_translated ?? j?.description)?.trim();

          if (raw) updated.description_original = raw;
          if (translated || raw) updated.description = translated || raw;
        }
      } catch (e) {
        console.error("Błąd Last.fm:", e);
      }
    }

    // Zapis jeśli są zmiany
    if (Object.keys(updated).length > 0) {
      await supabase.from("albums").update(updated).eq("id", album.id);
      results.push({ id: album.id, updated });
    }
  }

  res.status(200).json({ updated: results.length, results });
}
