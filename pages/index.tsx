// pages/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../src/lib/supabaseClient';
import SpotifyImporter from '../src/components/SpotifyImporter';
import Header from '../src/components/Header';

function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function HomePage() {
  const router = useRouter();

const [albums, setAlbums] = useState<{
  id: string;
  title: string;
  artist_name: string;
  cover_url: string;
  avg_rating: string;
  votes: number;
  is_favorite: boolean;
}[]>([]);


  const [total, setTotal] = useState<number | null>(0);
  const [artists, setArtists] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [artistFilter, setArtistFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [ratingMin, setRatingMin] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('title');
  const [page, setPage] = useState(1);
  const limit = 20;

  const debouncedSearch = useDebounced(search, 400);

  useEffect(() => {
    fetchArtists();
  }, []);

  useEffect(() => {
    fetchAlbums();
    updateURL();
  }, [page, artistFilter, genreFilter, yearFrom, yearTo, ratingMin, debouncedSearch, sortBy]);
    // 🔥 Realtime aktualizacja ocen
    useEffect(() => {
      const channel = supabase
        .channel('ratings-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ratings',
          },
          (payload) => {
            console.log('🎧 Zmiana ocen wykryta:', payload);
            // Odśwież listę albumów po każdej zmianie
            fetchAlbums();
          }
        )
        .subscribe();

      // cleanup
      return () => {
        supabase.removeChannel(channel);
      };
    }, []);

  const updateURL = () => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (artistFilter) params.artist = artistFilter;
    if (genreFilter) params.genre = genreFilter;
    if (yearFrom) params.yearFrom = yearFrom;
    if (yearTo) params.yearTo = yearTo;
    if (ratingMin !== '') params.rmin = String(ratingMin);
    if (sortBy !== 'title') params.sort = sortBy;
    if (page > 1) params.page = String(page);
    router.replace({ pathname: '/', query: params }, undefined, { shallow: true });
  };

  async function fetchArtists() {
    const { data, error } = await supabase.from('artists').select('id, name').order('name');
    if (error) console.error('Błąd przy pobieraniu artystów:', error);
    else setArtists(data || []);
  }

async function fetchAlbums() {
  try {
    const p_search = debouncedSearch || undefined;
    const p_artist = artistFilter || undefined;
    const p_genre = genreFilter && genreFilter !== '__NO_GENRE__' ? genreFilter : undefined;
    const p_year_from = yearFrom ? Number(yearFrom) : undefined;
    const p_year_to = yearTo ? Number(yearTo) : undefined;
    const p_min_avg = ratingMin === '' ? undefined : Number(ratingMin);
    const p_limit = limit;
    const p_offset = (page - 1) * limit;
    const p_sort = sortBy || 'title';

    // ✅ Budujemy zapytanie krok po kroku
    let query = supabase
      .from('albums')
      .select(`
        id,
        title,
        year,
        cover_url,
        artist_id,
        artists(name)
      `)
      .range(p_offset, p_offset + p_limit - 1)
      .order(p_sort);

    // ✅ Dodajemy filtry tylko jeśli istnieją
    if (p_artist) query = query.eq('artist_id', p_artist);
    if (p_genre) query = query.eq('genre', p_genre);

    const { data: rows, error: rowsErr } = await query;

    if (rowsErr) {
      console.error('Error fetching albums', rowsErr);
      setAlbums([]);
      setTotal(0);
      return;
    }

    const albumsWithArtistNames = (rows || []).map((album: any) => ({
      ...album,
      artist_name: album.artists?.name || 'Nieznany artysta',
    }));

    const { data: cnt, error: cntErr } = await supabase.rpc('count_albums', {
      p_search,
      p_artist,
      p_genre,
      p_year_from,
      p_year_to,
      p_min_avg,
    });

    if (cntErr) {
      console.error('Error fetching album count', cntErr);
      setTotal(0);
    } else {
      const totalCount = Array.isArray(cnt) ? cnt[0] : cnt;
      setTotal(typeof totalCount === 'number' ? totalCount : Number(totalCount));
    }

    const { data: ratings, error: ratingsErr } = await supabase
      .from('ratings')
      .select('album_id, rating')
      .in('album_id', rows.map((row: any) => row.id));

    if (ratingsErr) console.error('Error fetching ratings', ratingsErr);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    let favorites: any[] = [];
    if (user) {
      const { data: favs, error: favErr } = await supabase
        .from('favorites')
        .select('album_id')
        .eq('user_id', user.id);
      if (!favErr && favs) favorites = favs;
    }

    const albumsWithRatingsAndFavorites = albumsWithArtistNames.map((album: any) => {
      const albumRatings = ratings?.filter((r: any) => r.album_id === album.id) || [];
      const avgRating =
        albumRatings.length > 0
          ? (
              albumRatings.reduce((sum: any, r: { rating: number }) => sum + r.rating, 0) /
              albumRatings.length
            ).toFixed(1)
          : '—';

      const isFavorite = favorites.some((f: any) => f.album_id === album.id);

      return {
        ...album,
        avg_rating: avgRating,
        votes: albumRatings.length,
        is_favorite: isFavorite,
      };
    });

    setAlbums(albumsWithRatingsAndFavorites);
  } catch (e) {
    console.error('fetchAlbums error', e);
    setAlbums([]);
    setTotal(0);
  }
}







  useEffect(() => {
  const channel = supabase
    .channel('favorites-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'favorites',
      },
      (payload) => {
        console.log('💖 Zmiana w ulubionych:', payload);
        fetchAlbums(); // odśwież albumy po zmianie
      }
    )
    .subscribe();

  // cleanup: usuń subskrypcję po zakończeniu działania
  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  const handleRating = async (albumId: string, rating: number) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert('Musisz być zalogowany');

    const { error } = await supabase.from('ratings').upsert({
      user_id: user.id,
      album_id: albumId,
      rating,
    });

    if (error) {
      console.error('Błąd przy zapisie oceny:', error);
      alert('Nie udało się zapisać oceny');
    } else {
      fetchAlbums();
    }
  };

  return (
    <>
      <Header />
      <div style={{ padding: '2rem' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>🎵 Lista albumów</h1>

        {/* FILTRY */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
            alignItems: 'center',
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj albumu..."
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #ddd',
              flex: '1',
              minWidth: '200px',
            }}
          />

          <select
            value={artistFilter}
            onChange={(e) => {
              setArtistFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #ddd',
            }}
          >
            <option value="">Wszyscy artyści</option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Rok od"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            style={{ width: 80, padding: '0.5rem', borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            placeholder="Rok do"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            style={{ width: 80, padding: '0.5rem', borderRadius: 8, border: '1px solid #ddd' }}
          />

          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #ddd',
            }}
          >
            <option value="">Wszystkie gatunki</option>
            <option value="__NO_GENRE__">Brak gatunku</option>
            <option value="Rock">Rock</option>
            <option value="Pop">Pop</option>
            <option value="Hip-Hop">Hip-Hop</option>
            <option value="Electronic">Electronic</option>
          </select>

          <select
            value={ratingMin}
            onChange={(e) => setRatingMin(e.target.value === '' ? '' : Number(e.target.value))}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #ddd',
            }}
          >
            <option value="">Min ocena</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #ddd',
            }}
          >
            <option value="title">Sortuj: Tytuł A–Z</option>
            <option value="year">Sortuj: Rok ↓</option>
          </select>
        </div>

        {/* LISTA ALBUMÓW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}
        >
        {albums.map((album) => (
          <Link
            key={album.id}
            href={`/album/${album.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              background: '#f9fafb',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              display: 'block',
              position: 'relative', // 👈 konieczne dla absolutnego pozycjonowania ❤️
            }}
          >
            <div style={{ textAlign: 'center', position: 'relative' }}>
              {/* ❤️ GUZIK ULUBIONYCH */}
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return alert('Musisz być zalogowany');

                  if (album.is_favorite) {
                    await supabase
                      .from('favorites')
                      .delete()
                      .eq('user_id', user.id)
                      .eq('album_id', album.id);
                  } else {
                    await supabase
                      .from('favorites')
                      .insert({ user_id: user.id, album_id: album.id });
                  }

                  fetchAlbums(); // odśwież po kliknięciu
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.6rem',
                  color: album.is_favorite ? '#ef4444' : '#d1d5db',
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  transition: 'color 0.2s ease-in-out',
                  zIndex: 2,
                }}
              >
                {album.is_favorite ? '❤️' : '🤍'}
              </button>

              {/* OKŁADKA */}
              {album.cover_url ? (
                <img
                  src={album.cover_url}
                  alt={album.title}
                  style={{
                    width: '100%',
                    height: '220px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '220px',
                    background: '#e5e7eb',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                  }}
                >
                  Brak okładki
                </div>
              )}

              {/* INFORMACJE */}
              <h3>{album.title}</h3>
              <p style={{ color: '#6b7280' }}>{album.artist_name || 'Nieznany artysta'}</p>
              <p>⭐ {album.avg_rating ?? '—'} ({album.votes ?? 0})</p>

              {/* OCENY */}
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  flexWrap: 'wrap',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRating(album.id, n);
                    }}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </Link>
        ))}

        </div>

        {/* PAGINACJA */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '0.5rem' }}>
            {total !== null ? `Wyników: ${total}` : 'Ładowanie...'}
          </p>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              marginRight: 10,
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Poprzednia
          </button>
          <span style={{ margin: '0 8px' }}>
            Strona {page} z {total ? Math.ceil(total / limit) : '?'}
          </span>
          <button
            disabled={total !== null && page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor:
                total !== null && page >= Math.ceil(total / limit)
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            Następna →
          </button>
        </div>

        <div style={{ marginTop: 40 }}>
          <SpotifyImporter onImported={fetchAlbums} />
        </div>
      </div>
    </>
  );
}
