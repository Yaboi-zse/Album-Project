import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../src/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);


      if (error) {
        console.error('Auth error:', error.message);
      }

      // ✅ pobierz zapamiętany adres i usuń go
      const redirectPath = localStorage.getItem('redirectAfterLogin') || '/';
      localStorage.removeItem('redirectAfterLogin');

      router.replace(redirectPath); // wróć tam, skąd użytkownik przyszedł
    };

    handleAuth();
  }, [router]);

  return <p>Logowanie trwa, proszę czekać...</p>;
}
