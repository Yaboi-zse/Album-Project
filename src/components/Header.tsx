// src/components/Header.tsx
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useFilters } from "../hooks/useFilters";

/**
 * Neon palette (used inline for a few accents; main styling uses Tailwind)
 */
const NEON = {
  blue: "#00eaff",
  magenta: "#ff2dff",
  purple: "#8a2be2",
  cyan: "#00ffd5",
};

export default function Header() {
  const router = useRouter();

  // THEME
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // USER
  const [user, setUser] = useState<any>(null);

  // FILTERS HOOK (global URL + state handling)
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
    clearAllFilters,
  } = useFilters();

  // Local UI state
  const [showFilters, setShowFilters] = useState(false);

  // Genres from DB
  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [genreSearch, setGenreSearch] = useState("");
  const filteredGenres = genreOptions.filter(g =>
    g.toLowerCase().includes(genreSearch.toLowerCase())
  );

  // Derived selected genres array
  const genres = genreFilter ? genreFilter.split(",").map(g => g.trim()).filter(Boolean) : [];

  // SEARCH SUGGESTIONS
  type Suggestion = { label: string; type: "album" | "genre" | "artist" | "track"; id?: string };
  const [searchSuggestions, setSearchSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const suggestionDebounceRef = useRef<number | null>(null);

  // FILTER PRESETS (persisted to localStorage)
  const initialPresets = () => {
    try {
      const raw = localStorage.getItem("filterPresets");
      if (!raw) {
        return [
          { name: "Rock Classics", genres: ["rock", "classic rock"], years: "1970-1990" },
          { name: "Electronic", genres: ["electronic", "techno", "house"], years: "2010-2024" },
        ];
      }
      return JSON.parse(raw);
    } catch {
      return [
        { name: "Rock Classics", genres: ["rock", "classic rock"], years: "1970-1990" },
        { name: "Electronic", genres: ["electronic", "techno", "house"], years: "2010-2024" },
      ];
    }
  };
  const [filterPresets, setFilterPresets] = useState<Array<{ name: string; genres: string[]; years: string }>>(initialPresets);

  // UI helpers
  const [showPresetsEditor, setShowPresetsEditor] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetGenres, setNewPresetGenres] = useState("");

  // Quick stats
  const hasActiveFilters = genres.length > 0 || !!yearFrom || !!yearTo || ratingMin !== "" || !!search;

  // -----------------------
  // EFFECTS
  // -----------------------

  // Load genres from Supabase
  useEffect(() => {
    let mounted = true;
    async function loadGenres() {
      const { data } = await supabase
        .from("albums")
        .select("genre")
        .not("genre", "is", null);

      if (!mounted) return;

      const all = new Set<string>();
      (data || []).forEach((a: any) =>
        a.genre
          ?.split(",")
          .map((g: string) => g.trim())
          .filter(Boolean)
          .forEach((g: string) => all.add(g))
      );

      setGenreOptions([...all].sort((a, b) => a.localeCompare(b)));
    }

    loadGenres();
    return () => {
      mounted = false;
    };
  }, []);

  // Supabase auth session
  useEffect(() => {
    let mounted = true;
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
    };
    getSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.subscription.unsubscribe();
      mounted = false;
    };
  }, []);

  // THEME: load from localStorage + apply to document
  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const t: "light" | "dark" = stored || (prefersDark ? "dark" : "light");
    setTheme(t);
    applyThemeToDoc(t);
  }, []);

  const applyThemeToDoc = (t: "light" | "dark") => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.background = "#03060a";
      document.body.style.background = "#03060a";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.background = "#ffffff";
      document.body.style.background = "#ffffff";
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeToDoc(newTheme);
    window.dispatchEvent(new CustomEvent("themeChange", { detail: newTheme }));
  };

  // -----------------------
  // SEARCH SUGGESTIONS (debounced)
  // -----------------------
  const fetchSearchSuggestions = async (q: string) => {
    try {
      if (!q || q.trim().length < 2) {
        setShowSuggestions(false);
        return;
      }
      const [{ data: albums }, { data: artists }, { data: tracks }] = await Promise.all([
        supabase
          .from("albums")
          .select("title, genre")
          .or(`title.ilike.%${q}%,genre.ilike.%${q}%`)
          .limit(8),
        supabase
          .from("artists")
          .select("id, name")
          .ilike("name", `%${q}%`)
          .limit(5),
        supabase
          .from("tracks")
          .select("id, title, artist_name")
          .or(`title.ilike.%${q}%,artist_name.ilike.%${q}%`)
          .limit(6),
      ]);

      if (albums || artists || tracks) {
        const albumSuggestions: Suggestion[] = (albums || [])
          .flatMap((d: any) => [
            d.title ? { label: d.title, type: "album" as const, id: undefined } : null,
            d.genre ? { label: d.genre, type: "genre" as const, id: undefined } : null,
          ])
          .filter(Boolean) as Suggestion[];

        const artistSuggestions: Suggestion[] = (artists || []).map((a: any) => ({
          label: a.name,
          type: "artist" as const,
          id: a.id as string,
        }));

        const trackSuggestions: Suggestion[] = (tracks || []).map((t: any) => ({
          label: `${t.title}${t.artist_name ? ` — ${t.artist_name}` : ""}`,
          type: "track" as const,
          id: t.id as string,
        }));

        const dedup = new Map<string, { label: string; type: "album" | "genre" | "artist" | "track"; id?: string }>();
        [...albumSuggestions, ...artistSuggestions, ...trackSuggestions].forEach((s) => {
          const key = `${s.type}:${s.label}:${s.id ?? ""}`;
          if (!dedup.has(key)) dedup.set(key, s);
        });

        setSearchSuggestions(Array.from(dedup.values()));
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error("fetchSearchSuggestions:", err);
    }
  };

  // call debounced
  const handleSearchInputChange = (value: string) => {
    setSearch(value);

    // debounce
    if (suggestionDebounceRef.current) {
      window.clearTimeout(suggestionDebounceRef.current);
    }
    suggestionDebounceRef.current = window.setTimeout(() => {
      fetchSearchSuggestions(value);
      suggestionDebounceRef.current = null;
    }, 280);
  };

  // click outside suggestions to close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && searchBoxRef.current.contains(target)) return;
      if (suggestionsRef.current && suggestionsRef.current.contains(target)) return;
      setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleSuggestionSelect = (s: Suggestion) => {
    setShowSuggestions(false);
    if (s.type === "artist" && s.id) {
      router.push(`/artist/${s.id}`);
      return;
    }
    if (s.type === "track" && s.id) {
      router.push(`/track/${s.id}`);
      return;
    }
    setSearch(s.label);
    applyFiltersToURL({ search: s.label, page: 1 });
  };

  // -----------------------
  // FILTER PRESETS MANAGEMENT
  // -----------------------
  useEffect(() => {
    try {
      localStorage.setItem("filterPresets", JSON.stringify(filterPresets));
    } catch (e) {
      // ignore
    }
  }, [filterPresets]);

  const applyPreset = (preset: { name: string; genres: string[]; years: string }) => {
    const nextGenres = preset.genres.join(",");
    setGenreFilter(nextGenres);
    const [from, to] = preset.years.split("-");
    setYearFrom(from ?? "");
    setYearTo(to ?? "");
    applyFiltersToURL({ genreFilter: nextGenres, yearFrom: from ?? "", yearTo: to ?? "", page: 1 });
    setShowFilters(false);
  };

  const saveCurrentAsPreset = () => {
    const name = newPresetName.trim() || `Preset ${filterPresets.length + 1}`;
    const preset = {
      name,
      genres: genres,
      years: `${yearFrom || ""}-${yearTo || ""}`,
    };
    setFilterPresets(p => [preset, ...p].slice(0, 12)); // keep up to 12
    setNewPresetName("");
    setShowPresetsEditor(false);
  };

  const deletePreset = (idx: number) => {
    setFilterPresets(p => p.filter((_, i) => i !== idx));
  };

  // -----------------------
  // Quick Filters
  // -----------------------
  const applyQuickNewReleases = () => {
    setYearFrom("2020");
    setYearTo("2024");
    applyFiltersToURL({ yearFrom: "2020", yearTo: "2024", page: 1 });
  };

  const applyQuickTopRatings = () => {
    setRatingMin(8);
    applyFiltersToURL({ ratingMin: 8, page: 1 });
  };

  // -----------------------
  // Genre toggle
  // -----------------------
  const handleGenreToggle = (g: string) => {
    const newGenres = genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g];
    const nextGenres = newGenres.join(",");
    setGenreFilter(nextGenres);
    applyFiltersToURL({ genreFilter: nextGenres, page: 1 });
  };

  // -----------------------
  // Clear search only
  // -----------------------
  const clearSearch = () => {
    setSearch("");
    setShowSuggestions(false);

    // update URL via hook
    // applyFiltersToURL will read search state from hook when called elsewhere (or we can call it)
    // To remove just `q` from URL use router shallow
    const q = { ...router.query };
    delete q.q;
    if (Object.keys(q).length === 0) {
      router.push("/", undefined, { shallow: true });
    } else {
      router.push({ pathname: "/", query: q }, undefined, { shallow: true });
    }
  };

  // handle enter in search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyFiltersToURL();
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // -----------------------
  // Auth button
  // -----------------------
  const handleAuth = async () => {
    if (user) {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
    } else {
      router.push("/login");
    }
  };

  // -----------------------
  // Small helper UI pieces
  // -----------------------
  const HeaderButton = ({ children, onClick, className = "" }: any) => (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg transition ${className}`}>
      {children}
    </button>
  );

  // -----------------------
  // JSX
  // -----------------------
  return (
    <header className="fixed top-0 left-0 w-full z-50">
      <div className="bg-white dark:bg-[#0b0f14] border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* LOGO */}
            <div className="flex items-center gap-3">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  // clear all filters when clicking logo (as in original)
                  clearAllFilters();
                  router.push("/");
                }}
                className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white hover:opacity-90 transition"
              >
                <span className="text-2xl">🎵</span>
                <span>AlbumApp</span>
              </a>

              {/* small quick info (only on wide screens) */}
              <div className="hidden md:flex items-center text-xs text-gray-500 dark:text-gray-400 ml-3">
                <span className="mr-3">Twoja kolekcja</span>
                <span className="px-2 py-1 rounded-full text-[11px]" style={{ background: "rgba(0,234,255,0.06)", color: NEON.blue }}>
                  neon
                </span>
              </div>
            </div>

            {/* SEARCH + FILTERS */}
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="w-full max-w-2xl relative" ref={searchBoxRef}>
                {/* Search input */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Szukaj albumów lub utworów..."
                    value={search}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => { if (searchSuggestions.length > 0) setShowSuggestions(true); }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f1418] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    aria-label="Szukaj albumów lub utworów"
                  />

                  {/* clear */}
                  {search && (
                    <button
                      onClick={clearSearch}
                      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#121617] transition"
                      title="Wyczyść"
                    >✖</button>
                  )}

                  {/* apply */}
                  <button
                    onClick={() => { applyFiltersToURL(); setShowSuggestions(false); }}
                    className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#121617] transition"
                    title="Szukaj"
                  >
                    🔍
                  </button>

                  {/* Filters button */}
                  <button
                    onClick={() => setShowFilters(s => !s)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                      showFilters ? "bg-blue-500 text-white border-blue-500" : hasActiveFilters
                        ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-300"
                        : "border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f1418] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#121617]"
                    }`}
                    aria-expanded={showFilters}
                    aria-controls="filters-panel"
                  >
                    <span>⚙</span>
                    <span className="hidden sm:inline">Filtry</span>

                      {hasActiveFilters && (
                        <div className="flex gap-1 items-center ml-2">
                          {search && (
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: NEON.blue, color: "#001" }}>
                              🔍
                            </span>
                          )}
                          {genres.length > 0 && (
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]" style={{ background: NEON.purple, color: "#001" }}>
                              🎵 {genres.length}
                            </span>
                          )}
                          {(yearFrom || yearTo) && (
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]" style={{ background: NEON.cyan, color: "#001" }}>
                              📅
                            </span>
                          )}
                          {ratingMin && (
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]" style={{ background: "#ffca28", color: "#001" }}>
                              ⭐
                            </span>
                          )}
                        </div>
                      )}
                  </button>
                </div>

                {/* Suggestions dropdown */}
                <div ref={suggestionsRef} className="absolute left-0 right-0 mt-2 z-40">
                  <AnimatePresence>
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="bg-white dark:bg-[#0b0f14] border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden"
                      >
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                          {searchSuggestions.map((sug, i) => (
                            <li key={i}>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSuggestionSelect(sug)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-[#0f1418] transition"
                              >
                                {sug.label}
                                <span className="ml-2 text-[10px] text-gray-400">
                                  {sug.type === "artist"
                                    ? "artysta"
                                    : sug.type === "genre"
                                    ? "gatunek"
                                    : sug.type === "track"
                                    ? "utwór"
                                    : "album"}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* NAV ACTIONS */}
            <nav className="flex items-center gap-3">
              <Link href="/favorites" className="hidden sm:inline px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#121617] transition">Ulubione</Link>
              <Link href="/profile" className="hidden sm:inline px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#121617] transition">Profil</Link>

              {/* Theme toggle */}
              <button onClick={toggleTheme} aria-label="Toggle theme" className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#121617] transition">
                {theme === "dark" ? "🌞" : "🌙"}
              </button>

              {/* Auth */}
              <button
                onClick={handleAuth}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${user ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}
              >
                {user ? "Wyloguj" : "Zaloguj"}
              </button>
            </nav>
          </div>
        </div>

        {/* FILTER PANEL */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              id="filters-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#071018] transition-colors"
            >
              <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* LEFT: Genres + quick filters + presets */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">🎵 Gatunki {genres.length > 0 && `(${genres.length} wybranych)`}
                      </p>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Szukaj gatunku..."
                          value={genreSearch}
                          onChange={(e) => setGenreSearch(e.target.value)}
                          className="px-3 py-1 rounded-lg text-sm w-36 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b0f14] text-gray-900 dark:text-gray-100 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                      {filteredGenres.map((g) => {
                        const active = genres.includes(g);
                        return (
                          <button
                            key={g}
                            onClick={() => handleGenreToggle(g)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${active ? "bg-blue-500 text-white border-blue-600" : "bg-gray-100 dark:bg-[#071018] text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-[#0b1316]"}`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick filters */}
                    <div className="mt-6 mb-4">
                      <p className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">🚀 Szybkie filtry</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={applyQuickNewReleases}
                          className="px-3 py-1.5 rounded-full text-sm border transition-all"
                          style={{
                            background: "rgba(0,234,255,0.08)",
                            border: "1px solid rgba(0,234,255,0.18)",
                            color: NEON.blue,
                          }}
                        >
                          📅 Nowości (2020-2024)
                        </button>

                        <button
                          onClick={applyQuickTopRatings}
                          className="px-3 py-1.5 rounded-full text-sm border transition-all"
                          style={{
                            background: "rgba(255,45,255,0.08)",
                            border: "1px solid rgba(255,45,255,0.18)",
                            color: NEON.magenta,
                          }}
                        >
                          ⭐ Top oceny (8+)
                        </button>

                        <button
                          onClick={() => { clearAllFilters(); }}
                          className="px-3 py-1.5 rounded-full text-sm border transition-all"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#9fb6d6",
                          }}
                        >
                          🧹 Wyczyść wszystko
                        </button>
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">💾 Zapisane preset-y</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowPresetsEditor(s => !s)}
                            className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018] text-gray-700 dark:text-gray-100"
                          >
                            {showPresetsEditor ? "Anuluj" : "Zapisz preset"}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {filterPresets.map((preset, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <button
                              onClick={() => applyPreset(preset)}
                              className="px-3 py-1.5 rounded-full text-sm border transition-all hover:scale-105"
                              style={{
                                background: "linear-gradient(45deg, rgba(138,43,226,0.06), rgba(0,234,255,0.06))",
                                border: "1px solid rgba(138,43,226,0.12)",
                                color: NEON.purple,
                              }}
                            >
                                🎵 {preset.name}
                            </button>
                              <button
                                onClick={() => deletePreset(idx)}
                                className="text-xs px-2 py-1 rounded-md text-red-500"
                                title="Usuń preset"
                              >
                                ✖
                              </button>
                          </div>
                        ))}
                      </div>

                      {showPresetsEditor && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Nazwa presetu"
                            value={newPresetName}
                            onChange={e => setNewPresetName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018] text-gray-900 dark:text-gray-100 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Gatunki (oddzielone przecinkami)"
                            value={newPresetGenres}
                            onChange={e => setNewPresetGenres(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018] text-gray-900 dark:text-gray-100 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const g = newPresetGenres.trim().length
                                  ? newPresetGenres.split(",").map(s => s.trim()).filter(Boolean)
                                  : genres;
                                const name = newPresetName.trim() || `Preset ${filterPresets.length + 1}`;
                                if (g.length === 0) {
                                  return alert("Podaj gatunki lub wybierz je z listy.");
                                }
                                setFilterPresets(p => [{ name, genres: g, years: `${yearFrom || ""}-${yearTo || ""}` }, ...p].slice(0, 12));
                                setNewPresetName("");
                                setNewPresetGenres("");
                                setShowPresetsEditor(false);
                              }}
                              className="px-3 py-2 rounded-md bg-blue-500 text-white"
                            >
                              Zapisz preset
                            </button>

                            <button
                              onClick={() => { setShowPresetsEditor(false); }}
                              className="px-3 py-2 rounded-md border"
                            >
                              Anuluj
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Year, Rating slider, actions */}
                  <div className="space-y-4">
                    {/* Year */}
                    <div>
                      <p className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">Rok wydania</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          placeholder="Od"
                          value={yearFrom || ""}
                          onChange={e => setYearFrom(e.target.value)}
                          className="w-1/2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018] text-gray-900 dark:text-gray-100 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Do"
                          value={yearTo || ""}
                          onChange={e => setYearTo(e.target.value)}
                          className="w-1/2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071018] text-gray-900 dark:text-gray-100 text-sm"
                        />
                      </div>
                    </div>

                    {/* Rating slider */}
                    <div>
                      <p className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">
                        ⭐ Minimalna ocena: <span style={{ color: NEON.cyan }}>{ratingMin || 0}/10</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={Number(ratingMin || 0)}
                          onChange={e => setRatingMin(Number(e.target.value))}
                          className="flex-1"
                          aria-label="Minimalna ocena"
                        />
                        <div className="w-12 text-center font-bold" style={{ color: NEON.cyan }}>
                          {ratingMin || 0}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-1 text-gray-400">
                        <span>0</span>
                        <span>10</span>
                      </div>
                    </div>

                    {/* Active filters visualization */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {hasActiveFilters ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="font-semibold" style={{ color: NEON.cyan }}>Aktywne filtry:</span>
                            {search && (
                              <span className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(0,234,255,0.08)", color: NEON.blue }}>
                                🔍 "{search}"
                              </span>
                            )}
                            {genres.map(g => (
                              <span key={g} className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(255,45,255,0.06)", color: NEON.magenta }}>
                                🎵 {g}
                              </span>
                            ))}
                            {yearFrom && yearTo && (
                              <span className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(138,43,226,0.06)", color: NEON.purple }}>
                                📅 {yearFrom}-{yearTo}
                              </span>
                            )}
                            {ratingMin && (
                              <span className="px-2 py-1 rounded-full text-xs" style={{ background: "rgba(255,200,0,0.06)", color: "#ffca28" }}>
                                ⭐ ≥ {ratingMin}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span>Brak aktywnych filtrów</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => { applyFiltersToURL(); setShowFilters(false); }}
                        className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        Zastosuj filtry
                      </button>

                      <button
                        onClick={() => { clearAllFilters(); }}
                        className="px-4 py-2 rounded-lg border"
                      >
                        Wyczyść
                      </button>

                      <button
                        onClick={() => setShowFilters(false)}
                        className="px-4 py-2 rounded-lg bg-gray-600 text-white"
                      >
                        Zamknij
                      </button>
                    </div>
                  </div>
                </div>

                {/* small hint */}
                <div className="mt-4 text-xs text-gray-400">
                  Tip: Kliknij nazwy gatunków, aby dodać je do filtrów. Presety są zapisywane w LocalStorage.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}



