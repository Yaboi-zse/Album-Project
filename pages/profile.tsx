// pages/profile.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import Link from 'next/link';

export default function ProfilePage() {
  type AlbumPreview = {
    id: string;
    title: string;
    cover_url: string;
    artist_name: string;
  };

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [favoriteAlbums, setFavoriteAlbums] = useState<AlbumPreview[]>([]);
  const [recentRatings, setRecentRatings] = useState<(AlbumPreview & { rating: number; date: string })[]>([]);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      if (!u) {
        window.location.href = '/login';
        return;
      }
      setUser(u);
      await getProfile(u.id);
      await getFavorites(u.id);
      await getRecentRatings(u.id);
      setLoading(false);
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('favorites-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('💖 Realtime zmiana w ulubionych', payload);
          getFavorites(user.id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function getProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('Błąd przy pobieraniu profilu:', error);
      return;
    }
    setProfile(data);
    setUsername(data.username || '');
    setBio(data.bio || '');
    setLocation(data.location || '');
  }

  async function getFavorites(userId: string) {
    const { data: favs, error } = await supabase
      .from('favorites')
      .select(`
        album_id,
        albums (
          id,
          title,
          cover_url,
          artist_id,
          artists (name)
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Błąd przy pobieraniu ulubionych:', error);
      return;
    }

    const albums =
      favs?.map((f: any) => ({
        id: f.albums?.id,
        title: f.albums?.title,
        cover_url: f.albums?.cover_url,
        artist_name: f.albums?.artists?.name || 'Nieznany artysta',
      })) ?? [];

    setFavoriteAlbums(albums);
  }

  async function getRecentRatings(userId: string) {
    const { data, error } = await supabase
      .from('ratings')
      .select(`
        rating,
        created_at,
        albums (
          id,
          title,
          cover_url,
          artist_id,
          artists (name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.error('Błąd przy pobieraniu ocen:', error);
      return;
    }

    const ratings =
      data?.map((r: any) => ({
        id: r.albums?.id,
        title: r.albums?.title,
        cover_url: r.albums?.cover_url,
        artist_name: r.albums?.artists?.name || 'Nieznany artysta',
        rating: r.rating,
        date: new Date(r.created_at).toLocaleDateString(),
      })) ?? [];

    setRecentRatings(ratings);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileName = `${user.id}-${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });

    if (uploadErr) {
      alert('Błąd przy uploadzie: ' + uploadErr.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
    getProfile(user.id);
  }

  async function handleSaveProfile() {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        bio,
        location,
        updated_at: new Date(),
      })
      .eq('id', user.id);

    if (error) alert('❌ Nie udało się zapisać zmian.');
    else {
      alert('✅ Zapisano zmiany!');
      setEditing(false);
      getProfile(user.id);
    }
  }

  if (loading) return <p style={{ padding: '2rem' }}>Ładowanie profilu...</p>;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>
        ← Powrót
      </Link>
      <h1 style={{ marginBottom: '1rem' }}>👤 Profil użytkownika</h1>

      {profile && (
        <>
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
              <input id="avatarInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
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
                onClick={() => document.getElementById('avatarInput')?.click()}
              />
            </div>

            <div style={{ flex: 1 }}>
              {editing ? (
                <>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', width: '100%' }} />
                  <textarea
                    placeholder="O mnie..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', marginTop: '0.5rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Lokalizacja"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', width: '100%', marginTop: '0.5rem' }}
                  />
                  <div style={{ marginTop: '0.75rem' }}>
                    <button onClick={handleSaveProfile} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', marginRight: '0.5rem' }}>
                      💾 Zapisz
                    </button>
                    <button onClick={() => setEditing(false)} style={{ background: '#e5e7eb', border: 'none', borderRadius: 6, padding: '0.5rem 1rem' }}>
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{profile.username || user.email}</h2>
                  <p style={{ color: '#6b7280' }}>{profile.bio || 'Brak opisu'}</p>
                  <p style={{ color: '#6b7280' }}>{profile.location || 'Brak lokalizacji'}</p>
                  <button onClick={() => setEditing(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                    ✏️ Edytuj profil
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h2>💖 Ulubione albumy</h2>
            {favoriteAlbums.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Brak ulubionych albumów.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {favoriteAlbums.map((album) => (
                  <Link href={`/album/${album.id}`} key={album.id} style={{ textDecoration: 'none', color: 'inherit', background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <img src={album.cover_url} alt={album.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                    <div style={{ padding: '0.5rem' }}>
                      <strong>{album.title}</strong>
                      <p style={{ margin: 0, color: '#6b7280' }}>{album.artist_name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2>⭐ Ostatnio ocenione</h2>
            {recentRatings.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Brak ocenionych albumów.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {recentRatings.map((r) => (
                  <Link href={`/album/${r.id}`} key={r.id} style={{ textDecoration: 'none', color: 'inherit', background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <img src={r.cover_url} alt={r.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                    <div style={{ padding: '0.5rem' }}>
                      <strong>{r.title}</strong>
                      <p style={{ margin: 0, color: '#6b7280' }}>{r.artist_name}</p>
                      <p style={{ margin: 0, color: '#f59e0b' }}>⭐ {r.rating}</p>
                      <small style={{ color: '#9ca3af' }}>{r.date}</small>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href={`/user/${profile.username}`} style={{ display: 'inline-block', marginTop: '2rem', color: '#3b82f6', textDecoration: 'none' }}>
            🌐 Zobacz mój profil publiczny
          </Link>
        </>
      )}
    </div>
  );
}
