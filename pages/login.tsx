import { supabase } from '../src/lib/supabaseClient';

export default function LoginPage() {
  const signInWithGoogle = async () => {
  // zapisz aktualny adres strony, żeby po logowaniu wrócić
  const redirectTo = window.location.pathname;
  localStorage.setItem('redirectAfterLogin', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) console.error('Error signing in:', error);
};


  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Zaloguj się</h1>
      <button
        onClick={signInWithGoogle}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600"
      >
        Zaloguj przez Google
      </button>
    </div>
  );
}
