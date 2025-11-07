// pages/api/spotify/import.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../src/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body;

  try {
    const {
      spotifyAlbumId, // spotify album id (opcjonalnie)
      title,
      artistName,
      coverUrl,
      year,
      genre,
      description,
    } = body;

    if (!title || !artistName) return res.status(400).json({ error: 'Missing title or artistName' });

    // 1) sprawdź czy artysta już istnieje (po nazwie)
    const { data: existingArtists } = await supabase
      .from('artists')
      .select('id')
      .ilike('name', artistName) // case-insensitive
      .limit(1);

    let artistId;
    if (existingArtists && existingArtists.length > 0) {
      artistId = existingArtists[0].id;
    } else {
      const { data: insertedArtist, error: artErr } = await supabase
        .from('artists')
        .insert({ name: artistName, image_url: coverUrl || null })
        .select('id')
        .single();

      if (artErr) throw artErr;
      artistId = insertedArtist.id;
    }

    // 2) dodaj album (upewnij się, że nie duplikujesz)
    // sprawdź po tytule + artist_id
    const { data: existingAlbums } = await supabase
      .from('albums')
      .select('id')
      .eq('title', title)
      .eq('artist_id', artistId)
      .limit(1);

    if (existingAlbums && existingAlbums.length > 0) {
      return res.status(200).json({ message: 'Album already exists', albumId: existingAlbums[0].id });
    }

    const { data: insertedAlbum, error: albErr } = await supabase
      .from('albums')
      .insert({
        title,
        artist_id: artistId,
        year: year ? parseInt(String(year)) : null,
        cover_url: coverUrl || null,
        genre: genre || null,
        description: description || null,
      })
      .select('id')
      .single();

    if (albErr) throw albErr;

    return res.status(200).json({ message: 'Imported', albumId: insertedAlbum.id });
  } catch (err: any) {
    console.error('import error', err);
    return res.status(500).json({ error: err.message || err });
  }
}
