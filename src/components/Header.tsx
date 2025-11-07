// src/components/Header.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function Header() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        borderBottom: '1px solid #eee',
        marginBottom: '2rem',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem' }}>
        🎶 AlbumBase
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user ? (
          <>
            <Link href="/profile" style={{ color: '#2563eb', textDecoration: 'none' }}>
              Profil
            </Link>
            <button
              onClick={signOut}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              Wyloguj
            </button>
          </>
        ) : (
          <button
            onClick={signInWithGoogle}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            Zaloguj przez Google
          </button>
        )}
      </div>
    </header>
  );
}
