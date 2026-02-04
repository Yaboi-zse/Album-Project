// src/components/AlbumCards.tsx

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

// Import shared components and styles
import { GenreTags } from './GenreTags'; // Assuming GenreTags.tsx is created
import { RATING_COLORS, NEON, neonGlowStyle } from '../../styles/theme';

// --- TYPE DEFINITIONS ---

interface Album {
  id: string | number;
  title: string;
  cover_url: string;
  rank?: number;
  artist_name?: string;
  genre?: string | null;
  avg_rating?: number | string;
  votes?: number;
  user_rating?: number | null;
  is_favorite?: boolean;
  favorites_count?: number;
}

interface Props {
  album: Album;
  onToggleFavorite: (albumId: string | number, isFavorite: boolean) => void;
  onRate: (albumId: string | number, value: number) => void;
  enableRating?: boolean;
  enableFavorite?: boolean;
  showStats?: boolean;
}

// --- COMPONENT ---

export function AlbumCards({
  album,
  onToggleFavorite,
  onRate,
  enableRating = true,
  enableFavorite = true,
  showStats = true,
}: Props) {
  const router = useRouter();

  // --- STATE FOR UI INTERACTIONS ---
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredRatingValue, setHoveredRatingValue] = useState<number | null>(null);

  // --- EVENT HANDLERS ---
  const handleRatingClick = (e: React.MouseEvent, value: number) => {
    e.stopPropagation(); // Prevent navigation when clicking a button
    e.preventDefault();
    onRate(album.id, value);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleFavorite(album.id, !!album.is_favorite);
  };

  // --- STYLES & ANIMATIONS ---
  const overlayVariants = {
    hidden: { opacity: 0, y: 6, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  const buttonSize = Math.min(40, Math.floor((240 - 24) / 10)); // 240 is assumed card width
  const ratingButtonStyle = {
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
  };

  // --- RENDER ---
  return (
    <motion.div
      className="relative w-full max-w-[240px] rounded-xl overflow-visible cursor-pointer"
      style={{
        background: "linear-gradient(180deg, rgba(93, 93, 136, 0.63), rgba(8,10,14,0.7))",
        border: "1px solid rgba(107, 103, 103, 0.88)",
        boxShadow: "0 10px 24px rgb(255, 252, 252), 0 0 0 1px rgb(255, 245, 245) inset",
        transition: "box-shadow 160ms ease, transform 160ms ease",
      }}
      initial={{ y: 0 }}
      animate={{
        y: isHovered ? -6 : 0,
        boxShadow: isHovered
          ? neonGlowStyle(NEON.magenta).boxShadow
          : "0 8px 18px rgba(0,0,0,0.6)",
      }}
      onClick={() => router.push(`/album/${album.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* --- COVER IMAGE & RATING OVERLAY --- */}
      <div className="relative h-52 w-full rounded-t-xl overflow-hidden">
        <img
          src={album.cover_url}
          alt={album.title}
          className="h-full w-full object-cover"
        />
        {/* RATING OVERLAY */}
        {enableRating && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: isHovered ? 1 : 0,
              transition: "opacity 120ms ease-out",
              pointerEvents: isHovered ? "auto" : "none",
            }}
          >
            <div
              className="absolute inset-0 rounded-t-xl pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.35))",
                backdropFilter: "blur(4px)",
              }}
            />
            <motion.div
              className="relative z-10 w-full px-3"
              initial="hidden"
              animate={isHovered ? "visible" : "hidden"}
              variants={overlayVariants}
              transition={{ duration: 0.16 }}
              onMouseLeave={() => setHoveredRatingValue(null)}
            >
              <div className="grid grid-cols-10 gap-1.5 w-full">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const value = idx + 1;
                  const isActive = album.user_rating === value;
                  const isHighlighted = hoveredRatingValue !== null && value <= hoveredRatingValue;

                  return (
                    <button
                      key={value}
                      type="button"
                      onMouseEnter={() => setHoveredRatingValue(value)}
                      onClick={(e) => handleRatingClick(e, value)}
                      style={{
                        ...ratingButtonStyle,
                        background: isActive
                          ? RATING_COLORS[value]
                          : isHighlighted
                          ? `${RATING_COLORS[value]}33`
                          : "rgba(255,255,255,0.08)",
                        border: `1px solid ${isActive || isHighlighted ? RATING_COLORS[value] : 'rgba(255,255,255,0.2)'}`,
                        transform: isActive ? "scale(1.2)" : isHighlighted ? "scale(1.1)" : "scale(1)",
                        boxShadow: isActive ? `0 0 12px ${RATING_COLORS[value]}` : 'none',
                        transition: "all 100ms ease",
                      }}
                      className="aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* --- INFO PANEL --- */}
      <div className="p-4 text-center rounded-b-xl h-[170px] flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-white">{album.title}</h3>
          <p className="text-xs text-gray-400 mb-2">{album.artist_name || 'Unknown Artist'}</p>
        </div>

        {/* GENRE TAGS (conditionally rendered) */}
        {album.genre && (
          <GenreTags genre={album.genre} collapseSignal={!isHovered} />
        )}

        {/* RATING & FAVORITE */}
        {(showStats || enableFavorite) && (
          <div className="mt-auto flex items-center justify-between text-sm">
            {showStats ? (
              <div className="flex items-center gap-2 text-yellow-400">
                <span className="text-yellow-300">⭐</span>
                <span className="font-bold text-white">{album.avg_rating ?? "—"}</span>
                <span className="text-xs text-gray-400">({album.votes ?? 0} głosów)</span>
              </div>
            ) : (
              <span />
            )}
            {enableFavorite && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFavoriteClick}
                  className="text-lg transition-transform hover:scale-110"
                  style={{
                    textShadow: album.is_favorite ? `0 2px 15px ${NEON.magenta}66` : undefined,
                  }}
                >
                  {album.is_favorite ? "❤️" : "🤍"}
                </button>
                <span className="text-xs text-gray-400">{album.favorites_count ?? 0}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
