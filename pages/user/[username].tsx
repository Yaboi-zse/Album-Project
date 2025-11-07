// pages/user/[username].tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/router'; // Dodaj ten import

export default function PublicProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [favoriteAlbums, setFavoriteAlbums] = useState<any[]>([]);
  const [recentRatings, setRecentRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter(); // Używamy useRouter do pobrania dynamicznego segmentu
  const { username } = router.query; // Pobieramy 'username' z query

  useEffect(() => {
    if (!username) return;
    const loadProfile = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profileError) {
        console.error('Błąd przy pobieraniu profilu publicznego:', profileError);
        return;
      }
      
      setProfile(profileData);

      // Pobierz ulubione albumy
      const { data: favs, error: favError } = await supabase
        .from('favorites')
        .select('album_id, albums (id, title, cover_url, artist_id, artists(name))')
        .eq('user_id', profileData.id);

      if (favError) {
        console.error('Błąd przy pobieraniu ulubionych albumów:', favError);
        return;
      }
      setFavoriteAlbums(favs);

      // Pobierz ostatnio ocenione albumy
      const { data: ratings, error: ratingsError } = await supabase
        .from('ratings')
        .select('album_id, rating, created_at, albums (id, title, cover_url, artist_id, artists(name))')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (ratingsError) {
        console.error('Błąd przy pobieraniu ocenionych albumów:', ratingsError);
        return;
      }
      setRecentRatings(ratings);
      setLoading(false);
    };
    loadProfile();
  }, [username]);

  if (loading) return <p>Ładowanie profilu...</p>;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>
        ← Powrót
      </Link>
      <h1 style={{ marginBottom: '1rem' }}>👤 Profil użytkownika {profile?.username}</h1>

      {profile && (
        <>
          {/* Sekcja z informacjami o użytkowniku */}
          <div
            style={{
              background: '#f9fafb',
              borderRadius: 12,
              padding: '1.5rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
            }}
          >
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <img
                src={profile.avatar_url || 'https://placehold.co/100x100?text=Avatar'}
                alt="avatar"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border: '3px solid #e5e7eb',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <h2>{profile.username}</h2>
              <p style={{ color: '#6b7280' }}>{profile.bio || 'Brak opisu'}</p>
              <p style={{ color: '#6b7280' }}>{profile.location || 'Brak lokalizacji'}</p>
            </div>
          </div>

          {/* 💖 Ulubione albumy */}
          <div style={{ marginBottom: '2rem' }}>
            <h2>💖 Ulubione albumy</h2>
            {favoriteAlbums.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Brak ulubionych albumów.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                {favoriteAlbums.map((album) => (
                  <Link
                    href={`/album/${album.album_id}`}
                    key={album.album_id}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      background: '#fff',
                      borderRadius: 8,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={album.albums.cover_url}
                      alt={album.albums.title}
                      style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '0.5rem' }}>
                      <strong>{album.albums.title}</strong>
                      <p style={{ margin: 0, color: '#6b7280' }}>{album.albums.artists?.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ⭐ Ostatnio ocenione */}
          <div>
            <h2>⭐ Ostatnio ocenione</h2>
            {recentRatings.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Brak ocenionych albumów.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                {recentRatings.map((r) => (
                  <Link
                    href={`/album/${r.album_id}`}
                    key={r.album_id}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      background: '#fff',
                      borderRadius: 8,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={r.albums.cover_url}
                      alt={r.albums.title}
                      style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '0.5rem' }}>
                      <strong>{r.albums.title}</strong>
                      <p style={{ margin: 0, color: '#6b7280' }}>{r.albums.artists?.name}</p>
                      <p style={{ margin: 0, color: '#f59e0b' }}>⭐ {r.rating}</p>
                      <small style={{ color: '#9ca3af' }}>{r.date}</small>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
