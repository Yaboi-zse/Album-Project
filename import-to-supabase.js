// import-to-supabase.js
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Brak danych Supabase w .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importData() {
  const file = 'spotify_albums.json';
  if (!fs.existsSync(file)) {
    console.error(`❌ Plik ${file} nie istnieje!`);
    process.exit(1);
  }

  const albums = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`🎵 Znaleziono ${albums.length} albumów do importu`);

  let addedArtists = 0;
  let addedAlbums = 0;

  for (const album of albums) {
    const { artist, title, year, cover_url, artist_id, spotify_url } = album;
    if (!artist || !title) continue;

    // 🔹 sprawdź, czy artysta istnieje
    const { data: existingArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('name', artist)
      .maybeSingle();

    let artistUuid;
    if (!existingArtist) {
      // 🔹 dodaj nowego artystę
      const { data: newArtist, error: artistError } = await supabase
        .from('artists')
        .insert([{ name: artist }])
        .select()
        .single();

      if (artistError) {
        console.error(`❌ Błąd przy dodawaniu artysty ${artist}:`, artistError.message);
        continue;
      }
      artistUuid = newArtist.id;
      addedArtists++;
    } else {
      artistUuid = existingArtist.id;
    }

    // 🔹 sprawdź, czy album istnieje
    const { data: existingAlbum } = await supabase
      .from('albums')
      .select('id')
      .eq('title', title)
      .eq('artist_id', artistUuid)
      .maybeSingle();

    if (existingAlbum) {
      console.log(`⚠️ Pomijam duplikat: ${title} — ${artist}`);
      continue;
    }

    // 🔹 dodaj album
    const { error: albumError } = await supabase.from('albums').insert([
      {
        title,
        artist_id: artistUuid,
        year: year ? parseInt(year) : null,
        cover_url,
        description: spotify_url || null,
      },
    ]);

    if (albumError) {
      console.error(`❌ Błąd przy dodawaniu albumu ${title}:`, albumError.message);
      continue;
    }

    addedAlbums++;
    console.log(`✅ Dodano album: ${title} (${artist})`);
  }

  console.log('\n🎉 Import zakończony!');
  console.log(`👩‍🎤 Dodano nowych artystów: ${addedArtists}`);
  console.log(`💿 Dodano nowych albumów: ${addedAlbums}`);
}

importData().catch((err) => console.error('❌ Błąd główny:', err));
