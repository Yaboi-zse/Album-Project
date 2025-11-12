import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // 🌓 Motyw
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeToSet = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(themeToSet);
    document.documentElement.classList.toggle("dark", themeToSet === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // 🔐 Sprawdzanie użytkownika i nasłuchiwanie sesji
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };
    getSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async () => {
    if (user) {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
    } else {
      router.push("/login");
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-white dark:bg-[#14181f] border-b border-gray-200 dark:border-gray-700 shadow-sm z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
          🎵 AlbumApp
        </Link>

        <nav className="flex items-center gap-6 text-gray-700 dark:text-gray-300 text-sm">
          <Link href="/favorites" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Ulubione
          </Link>
          <Link href="/profile" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Profil
          </Link>

          {/* 🌗 Motyw */}
          <button
            onClick={toggleTheme}
            className="ml-4 p-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#1e232b] transition"
          >
            {theme === "dark" ? "🌞" : "🌙"}
          </button>

          {/* 🔑 Logowanie / Wylogowanie */}
          <button
            onClick={handleAuth}
            className={`ml-4 px-3 py-2 rounded-lg transition text-white ${
              user
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {user ? "Wyloguj się" : "Zaloguj się"}
          </button>
        </nav>
      </div>
    </header>
  );
}
