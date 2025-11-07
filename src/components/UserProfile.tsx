import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Album {
  id: string;
  title: string;
  cover_url?: string;
  artist_id: string;
}

export default function AlbumList() {
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data } = await supabase.from('albums').select('*');
      if (data) setAlbums(data);
    };

    fetchAlbums();
  }, []);

  const handleRating = async (albumId: string, rating: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Musisz być zalogowany');

    const { error } = await supabase.from('ratings').upsert({
      user_id: user.id,
      album_id: albumId,
      rating,
    });

    if (error) return alert('Błąd przy zapisie oceny');
    alert('Ocena zapisana!');
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
      {albums.map((album) => (
        <div key={album.id} className="border p-2 rounded shadow">
          {album.cover_url && <img src={album.cover_url} alt={album.title} className="w-full h-48 object-cover rounded" />}
          <h3 className="font-bold mt-2">{album.title}</h3>
          <button
            className="mt-2 bg-blue-500 text-white px-2 py-1 rounded"
            onClick={() => handleRating(album.id, 8)} // przykładowa ocena 8
          >
            Oceń 8
          </button>
        </div>
      ))}
    </div>
  );
}
