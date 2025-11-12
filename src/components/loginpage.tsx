import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { syncProfile } from "../lib/syncprofile";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const handleUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        // Sprawdź, czy profil istnieje
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        // Jeśli nie istnieje — utwórz
        if (!profile) {
          await supabase.from("profiles").insert([
            {
              id: data.user.id,
              username: data.user.user_metadata.full_name || data.user.email,
              avatar_url: data.user.user_metadata.avatar_url,
              created_at: new Date().toISOString(),
            },
          ]);
        }

        router.push("/");
      }
    };
    handleUser();
  }, [router]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f131a] transition-colors duration-300">
      <div className="bg-white dark:bg-[#1a1f29] rounded-2xl shadow-lg p-8 w-full max-w-sm border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
          🔑 Zaloguj się
        </h1>

        <button
          onClick={handleLogin}
          className="w-full py-3 rounded-lg bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium transition"
        >
          Zaloguj się przez Google
        </button>
      </div>
    </div>
  );
}
