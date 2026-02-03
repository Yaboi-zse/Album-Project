<<<<<<< HEAD
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
=======
// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// Upewnij się, że Twoje zmienne środowiskowe są ustawione.
// Dla Next.js będą to NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Walidacja, czy zmienne środowiskowe są dostępne
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL and anonymous key are required. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
>>>>>>> 3a6798f ('')
