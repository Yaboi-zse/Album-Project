import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../src/lib/supabaseClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const trackData = req.body;

  try {
    console.log("💾 Saving track to database:", trackData);

    // Sprawdź czy track już istnieje
    const { data: existing } = await supabase
      .from("tracks")
      .select("*")
      .eq("spotify_id", trackData.spotify_id)
      .maybeSingle();

    let result;
    
    if (existing) {
      // Aktualizuj istniejący
      result = await supabase
        .from("tracks")
        .update({
          title: trackData.title,
          duration: trackData.duration,
          track_number: trackData.track_number,
          spotify_url: trackData.spotify_url,
          preview_url: trackData.preview_url,
          artist_name: trackData.artist_name,
          album_id: trackData.album_id ?? null,
        })
        .eq("spotify_id", trackData.spotify_id)
        .select();
    } else {
      // Wstaw nowy
      result = await supabase
        .from("tracks")
        .insert({
          spotify_id: trackData.spotify_id,
          title: trackData.title,
          duration: trackData.duration,
          track_number: trackData.track_number,
          spotify_url: trackData.spotify_url,
          preview_url: trackData.preview_url,
          artist_name: trackData.artist_name,
          album_id: trackData.album_id ?? null,
        })
        .select();
    }

    if (result.error) {
      console.error("❌ Database error:", result.error);
      return res.status(500).json({ 
        error: 'Database error',
        details: result.error 
      });
    }

    console.log("✅ Track saved:", result.data);
    res.status(200).json(result.data?.[0] || { success: true });

  } catch (error: any) {
    console.error('❌ Save error:', error);
    res.status(500).json({ 
      error: 'Failed to save track',
      message: error.message 
    });
  }
}
