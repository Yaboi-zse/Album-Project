// src/components/Header.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/router";
import { useFilters } from "../hooks/useFilters";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<any>(null);
  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();
  
  // UŻYJ HOOKA ZAMIAST LOCAL STATE
  const {
    search,
    setSearch,
    genreFilter,
    setGenreFilter,
    yearFrom,
    setYearFrom,
    yearTo,
    setYearTo,
    ratingMin,
    setRatingMin,
    applyFiltersToURL,
    clearAllFilters
  } = useFilters();

  // Konwertuj genreFilter string na array dla UI
  const genres = genreFilter ? genreFilter.split(",") : [];

  // pobierz listę gatunków z Supabase
  useEffect(() => {
    async function loadGenres() {
      const { data } = await supabase
        .from("albums")
        .select("genre")
        .not("genre", "is", null);

      const all = new Set<string>();

      (data || []).forEach((a: any) => {
        a.genre
          ?.split(",")
          .map((g: string) => g.trim())
          .filter(Boolean)
          .forEach((g: string) => all.add(g));
      });

      setGenreOptions([...all].sort());
    }

    loadGenres();
  }, []);

  // 🌓 MOTYW DLA CAŁEJ STRONY
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeToSet = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(themeToSet);
    
    if (themeToSet === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.background = "#03060a";
      document.body.style.background = "#03060a";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.background = "#ffffff";
      document.body.style.background = "#ffffff";
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.background = "#03060a";
      document.body.style.background = "#03060a";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.background = "#ffffff";
      document.body.style.background = "#ffffff";
    }
  };

  // Obsługa Enter w wyszukiwarce
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFiltersToURL();
    }
  };

  // Zastosuj filtry (dla przycisku wyszukiwania)
  const applyFilters = () => {
    applyFiltersToURL();
  };

  // Wyczyść tylko wyszukiwanie
  const clearSearch = () => {
    setSearch("");
    
    const query = { ...router.query };
    delete query.q;
    
    if (Object.keys(query).length === 0) {
      router.push("/", undefined, { shallow: true });
    } else {
      router.push({ pathname: "/", query }, undefined, { shallow: true });
    }
  };

  // Zmiana gatunków
  const handleGenreToggle = (g: string) => {
    const newGenres = genres.includes(g) 
      ? genres.filter(x => x !== g) 
      : [...genres, g];
    setGenreFilter(newGenres.join(","));
  };

  // Zmiana roku
  const handleYearChange = (field: 'from' | 'to', value: string) => {
    if (field === 'from') {
      setYearFrom(value);
    } else {
      setYearTo(value);
    }
  };

  // Zmiana oceny
  const handleRatingChange = (value: string) => {
    setRatingMin(value);
  };

  // Zastosuj wszystkie zmiany filtrow
  const applyAllFilters = () => {
    applyFiltersToURL();
  };

  // Kliknięcie w logo
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clearAllFilters();
  };

  // 🔐 user
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };
    getSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
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

  const hasActiveFilters = genres.length > 0 || yearFrom || yearTo || ratingMin !== "" || search;

  return (
    <header className="fixed top-0 left-0 w-full bg-white dark:bg-[#14181f] border-b border-gray-200 dark:border-gray-700 shadow-sm z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* LOGO */}
        <a 
          href="/" 
          onClick={handleLogoClick}
          className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl">🎵</span>
          <span>AlbumApp</span>
        </a>

        {/* 🔍 WYSZUKIWARKA */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Szukaj albumów..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1f25] text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                ✕
              </button>
            )}
            <button
              onClick={applyFilters}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-1 transition-colors"
              title="Szukaj"
            >
              🔍
            </button>
          </div>

          <button
            onClick={() => setShowFilters(s => !s)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
              showFilters 
                ? "bg-blue-500 text-white border-blue-500" 
                : hasActiveFilters
                ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-300"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1f25] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e232b]"
            }`}
          >
            <span>⚙</span>
            <span>Filtry</span>
            {hasActiveFilters && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </div>

        {/* NAV */}
        <nav className="flex items-center gap-4 text-gray-700 dark:text-gray-300 text-sm">
          <Link 
            href="/favorites" 
            className="hover:text-blue-500 dark:hover:text-blue-400 transition px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e232b]"
          >
            Ulubione
          </Link>

          <Link 
            href="/profile" 
            className="hover:text-blue-500 dark:hover:text-blue-400 transition px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e232b]"
          >
            Profil
          </Link>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#1e232b] transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "🌞" : "🌙"}
          </button>

          <button
            onClick={handleAuth}
            className={`px-4 py-2 rounded-lg text-white font-medium transition ${
              user ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {user ? "Wyloguj" : "Zaloguj"}
          </button>
        </nav>
      </div>

      {/* PANEL FILTRÓW */}
      {showFilters && (
        <div className="w-full bg-white dark:bg-[#1a1f25] border-t border-gray-200 dark:border-gray-700 shadow-lg py-6 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Gatunki */}
              <div className="lg:col-span-2">
                <p className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
                  Gatunki {genres.length > 0 && `(${genres.length} wybranych)`}
                </p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {genreOptions.map((g: string) => (
                    <button
                      key={g}
                      onClick={() => handleGenreToggle(g)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        genres.includes(g)
                          ? "bg-blue-500 text-white border-blue-600 shadow-sm"
                          : "bg-gray-100 dark:bg-[#111418] text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-[#1a1f25]"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rok */}
              <div>
                <p className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
                  Rok wydania
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Od</label>
                    <input
                      type="number"
                      placeholder="1950"
                      value={yearFrom}
                      onChange={e => handleYearChange('from', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111418] text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Do</label>
                    <input
                      type="number"
                      placeholder="2025"
                      value={yearTo}
                      onChange={e => handleYearChange('to', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111418] text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Ocena */}
              <div>
                <p className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
                  Minimalna ocena
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="0"
                    value={ratingMin}
                    onChange={e => handleRatingChange(e.target.value)}
                    className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111418] text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">/ 10</span>
                </div>
              </div>
            </div>

            {/* AKCJE FILTRÓW */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {hasActiveFilters ? (
                  <span>Aktywne filtry: {[
                    search && `szukaj: "${search}"`,
                    genres.length > 0 && `${genres.length} gatunków`,
                    yearFrom && `od ${yearFrom}`,
                    yearTo && `do ${yearTo}`,
                    ratingMin && `ocena ≥ ${ratingMin}`
                  ].filter(Boolean).join(', ')}</span>
                ) : (
                  <span>Brak aktywnych filtrów</span>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={applyAllFilters}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
                >
                  Zastosuj filtry
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900 hover:bg-red-100 dark:hover:bg-red-800 transition text-sm font-medium"
                  >
                    Wyczyść wszystkie
                  </button>
                )}
                
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium transition"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}