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
const ALBUMS_PER_PAGE = 15;

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
      className={`pt-24 pb-10 min-h-screen transition-colors duration-300
        bg-white text-black
        dark:bg-[#03060a] dark:text-[#e6eef8]
        dark:bg-[radial-gradient(1200px_600px_at_10%_10%,rgba(138,43,226,0.06),transparent),radial-gradient(1000px_500px_at_90%_90%,rgba(0,234,255,0.04),transparent),#03060a]
      `}
    >
      <div className="w-full px-4">
        {/* --- SEKCJA TOP 10 ALBUMÓW --- */}
        <Top10Slider
          albums={top10Albums}
          onToggleFavorite={handleToggleFavorite}
          onRate={handleUpsertRating}
        />

        {/* --- GŁÓWNY LAYOUT: LISTA ALBUMÓW + PANEL BOCZNY --- */}
        <section className="mb-12 flex flex-col lg:flex-row gap-8 w-full">
          {/* LEWA STRONA – SIATKA ALBUMÓW */}
          <div className="flex-1">
            {loading ? (
              <div className="py-24 text-center text-gray-400">Ładowanie albumów...</div>
            ) : albums.length > 0 ? (
              <div
                className="grid gap-x-6 gap-y-16 justify-items-center sm:justify-items-start"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
              >
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
    </main>
  );
}
