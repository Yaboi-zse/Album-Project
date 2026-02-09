// pages/index.tsx

import React from 'react';

// Importy hooków
import { useFilters } from '../src/hooks/useFilters';
import { useTheme } from '../src/hooks/useTheme';
import { useAlbumData } from '../src/hooks/useAlbumData';

// Importy komponentów
import { Top10Slider } from '../src/components/Top10Slider';
import { RecommendationsSidebar } from '../src/components/RecommendationsSidebar';
import { AlbumCards } from '../src/components/AlbumCards';
import { Analytics } from "@vercel/analytics/next"
const ALBUMS_PER_PAGE = 20;

export default function HomePage() {
  // --- HOOKS ---
  useTheme();
  const {
    search,
    genreFilter,
    yearFrom,
    yearTo,
    ratingMin,
    sortBy,
    page,
    setPage,
  } = useFilters();

  const {
    albums,
    top10Albums,
    topSingles,
    newReleases,
    recommendations,
    total,
    loading,
    handleToggleFavorite,
    handleUpsertRating,
  } = useAlbumData(
    {
      search,
      genreFilter,
      yearFrom,
      yearTo,
      ratingMin: ratingMin === '' ? undefined : String(ratingMin),
      sortBy,
      page,
    },
    ALBUMS_PER_PAGE
  );

  return (
    <main
      className={`pt-24 pb-10 min-h-screen transition-colors duration-300 relative overflow-hidden
        bg-[#f2f5fa] text-black
        dark:bg-[#03060a] dark:text-[#e6eef8]
      `}
    >
      {/* Subtelne tło żeby kafelki się wyróżniały */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_10%_15%,rgba(120,160,255,0.08),transparent),radial-gradient(900px_500px_at_90%_80%,rgba(0,234,255,0.06),transparent)]" />
      <div className="absolute inset-0 dark:bg-[radial-gradient(1200px_700px_at_12%_10%,rgba(138,43,226,0.08),transparent),radial-gradient(1000px_600px_at_88%_85%,rgba(0,234,255,0.05),transparent),#03060a]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/20 dark:from-black/40 dark:to-black/20" />

      <div className="relative z-10 w-full px-4">
        {/* --- SEKCJA TOP 10 ALBUMÓW --- */}
        <Top10Slider
          albums={top10Albums}
          singles={topSingles}
          onToggleFavorite={handleToggleFavorite}
          onRate={handleUpsertRating}
        />

        {/* --- GŁÓWNY LAYOUT: LISTA ALBUMÓW + PANEL BOCZNY --- */}
        <section className="mb-12 flex flex-col lg:flex-row lg:items-start gap-8 w-full mt-4">
          {/* LEWA STRONA – SIATKA ALBUMÓW */}
          <div className="flex-1">
            {loading ? (
              <div className="py-24 text-center text-gray-400">Ładowanie albumów...</div>
            ) : albums.length > 0 ? (
              <div className="grid gap-x-6 gap-y-16 justify-items-start grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {albums.map((album) => (
                  <AlbumCards
                    key={album.id}
                    album={album}
                    onToggleFavorite={handleToggleFavorite}
                    onRate={handleUpsertRating}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-gray-400">
                <p className="text-xl">Brak albumów pasujących do filtrów.</p>
                <p>Spróbuj zmienić kryteria wyszukiwania.</p>
              </div>
            )}
          </div>

          {/* PRAWA STRONA – PANEL Z REKOMENDACJAMI */}
          <RecommendationsSidebar
            newReleases={newReleases}
            recommendations={recommendations}
            topAlbums={top10Albums}
            topSingles={topSingles}
          />
        </section>

        {/* --- PAGINACJA --- */}
        {total && total > ALBUMS_PER_PAGE && (
          <div className="mt-10 flex justify-center items-center gap-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                background: "linear-gradient(90deg, rgba(255,0,255,0.1), rgba(0,234,255,0.1))",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#dff6ff",
              }}
            >
              ← Poprzednia
            </button>
            <span className="text-gray-700 dark:text-[#cfeaff] font-semibold">
              Strona {page} / {Math.ceil(total / ALBUMS_PER_PAGE)}
            </span>
            <button
              disabled={page >= Math.ceil(total / ALBUMS_PER_PAGE)}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                background: "linear-gradient(90deg, rgba(0,234,255,0.1), rgba(255,0,255,0.1))",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#dff6ff",
              }}
            >
              Następna →
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 mt-16 border-t border-white/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-500 dark:text-gray-400 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-wrap gap-4">
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-200 transition">O nas</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Regulamin</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Prywatność</a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Kontakt</a>
          </div>
          <div className="text-xs">
            Strona została wykonana przez Yaboi/Mikołaj Misiak
          </div>
        </div>
      </footer>
    </main>
  );
}
