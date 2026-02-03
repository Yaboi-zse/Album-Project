// src/components/RecommendationsSidebar.tsx

import React from 'react';
import { useRouter } from 'next/router';

// Definicja typów dla propsów
interface Album {
  id: string | number;
  title: string;
  cover_url: string;
  artists?: { name: string; } | null;
  artist_name?: string; // Może pochodzić z różnych źródeł
  genre?: string | null;
}

interface Props {
  newReleases: Album[];
  recommendations: Album[];
  topAlbums: Album[];
}

export function RecommendationsSidebar({ newReleases, recommendations, topAlbums }: Props) {
  const router = useRouter();

  const renderAlbumItem = (album: Album) => {
    // Normalizacja nazwy artysty
    const artistName = album.artist_name || album.artists?.name || "Nieznany artysta";
    return (
      <div
        key={album.id}
        onClick={() => router.push(`/album/${album.id}`)}
        className="flex gap-3 items-center mb-3 cursor-pointer hover:bg-white/10 dark:hover:bg-black/20 p-1 rounded-md transition-colors"
      >
        <img src={album.cover_url} className="w-12 h-12 object-cover rounded" alt={album.title} />
        <div>
          <p className="font-semibold text-sm line-clamp-1">{album.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{artistName}</p>
          {album.genre && <p className="text-[10px] text-purple-600 dark:text-purple-400">{album.genre.split(',')[0]}</p>}
        </div>
      </div>
    );
  };

  return (
    <aside className="hidden lg:block lg:w-[350px] xl:w-[400px] space-y-8 sticky top-28 self-start">
      {/* NOWE WYDANIA */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20">
        <h3 className="text-lg font-bold mb-4">🆕 Nowe wydania</h3>
        {newReleases.length === 0 
            ? <p className="text-gray-500 dark:text-gray-400 text-sm">Brak nowości.</p>
            : newReleases.slice(0, 5).map(renderAlbumItem)
        }
      </div>

      {/* REKOMENDACJE */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20">
        <h3 className="text-lg font-bold mb-4">✨ Dla Ciebie</h3>
        {recommendations.length === 0 
            ? <p className="text-gray-500 dark:text-gray-400 text-sm">Oceń kilka albumów, aby otrzymać rekomendacje.</p>
            : recommendations.slice(0, 5).map(renderAlbumItem)
        }
      </div>

      {/* POPULARNE DZISIAJ */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20">
        <h3 className="text-lg font-bold mb-4">🔥 Popularne dziś</h3>
        {topAlbums.length === 0
            ? <p className="text-gray-500 dark:text-gray-400 text-sm">Brak popularnych albumów.</p>
            : topAlbums.slice(0, 5).map(renderAlbumItem)
        }
      </div>
    </aside>
  );
}
