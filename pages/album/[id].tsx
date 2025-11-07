import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import RatingStars from '../../components/RatingStars';

export default function AlbumPage() {
  const router = useRouter();
  const { id } = router.query;

  const [album, setAlbum] = useState<any>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // 🟩 Pobierz dane albumu
  useEffect(() => {
    if (!id) return;
    async function fetchAlbum() {
      const { data, error } = await supabase
        .from('albums')
        .select(`*, artists(name)`)
        .eq('id', id)
        .single();

      if (error) console.error(error);
      else setAlbum(data);
    }

    async function fetchAverage() {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('album_id', id);

      if (!error && data) {
        const avg =
          data.length > 0
            ? data.reduce((sum, r) => sum + r.rating, 0) / data.length
            : null;
        setAvgRating(avg);
      }
    }

    fetchAlbum();
    fetchAverage();
  }, [id]);

  // 🟨 Obsługa oceny
const handleRate = async (value: number) => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert('Musisz być zalogowany, by oceniać!');
    router.push('/login');
    return;
  }

  const { error } = await supabase.from('ratings').upsert({
    user_id: user.id,
    album_id: id,
    rating: value,
  });

  if (error) {
    console.error(error);
    alert('Błąd przy zapisie oceny');
  } else {
    setRating(value);
    // 🔁 pobierz nową średnią po zapisaniu
    const { data } = await supabase
      .from('ratings')
      .select('rating')
      .eq('album_id', id);
    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      setAvgRating(avg);
    }
  }
};


  if (!album) return <p>Ładowanie...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{album.title}</h1>
      <h3>{album.artists?.name}</h3>
      {album.cover_url && (
        <img src={album.cover_url} alt={album.title} width={200} />
      )}
      <p>{album.description}</p>

      <div style={{ marginTop: '1rem' }}>
  <p>Średnia ocen: {avgRating ? avgRating.toFixed(1) : 'Brak ocen'}</p>

  <p>Twoja ocena:</p>
  <RatingStars
    initialValue={rating || 0}
    editable
    onChange={handleRate}
  />
</div>
    </div>
  );
}
