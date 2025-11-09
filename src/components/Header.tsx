import { useEffect, useState } from "react";
import Link from "next/link";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Ustawienie motywu przy ładowaniu
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (
      storedTheme === "dark" ||
      (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setTheme("light");
    }
  }, []);

  // Funkcja przełączająca motyw
  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
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

          {/* 🌗 Przycisk zmiany motywu */}
          <button
            onClick={toggleTheme}
            className="ml-4 p-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#1e232b] transition"
            aria-label="Zmień motyw"
          >
            {theme === "dark" ? "🌞" : "🌙"}
          </button>
        </nav>
      </div>
    </header>
  );
}
