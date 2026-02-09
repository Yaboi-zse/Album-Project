// src/components/Top10Slider.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimationFrame, useMotionValue } from 'framer-motion';
import { AlbumCards } from './AlbumCards';
import { useRouter } from 'next/router';

// --- TYPY ---
interface Album {
  id: string | number;
  title: string;
  cover_url: string;
  artist_name?: string;
  avg_rating?: number | string;
  votes?: number;
  user_rating?: number | null;
  is_favorite?: boolean;
  favorites_count?: number;
}

interface Track {
  id: string | number;
  title: string;
  cover_url?: string | null;
  artist_name?: string | null;
  avg_rating?: number | string;
  votes?: number;
}

interface Props {
  albums: Album[];
  singles: Track[];
  onToggleFavorite: (albumId: string | number, isFavorite: boolean) => void;
  onRate: (albumId: string | number, value: number) => void;
}

const CARD_WIDTH = 240;
const CARD_GAP = 24; // gap-6
const BASE_SPEED_PX_PER_SEC = 40;

export function Top10Slider({ albums, singles, onToggleFavorite, onRate }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const directionRef = useRef(1);
  const speedRef = useRef(1);

  const [maxOffset, setMaxOffset] = useState(0);
  const [speedFactor, setSpeedFactor] = useState(1);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);

  // --- OBLICZANIE SZEROKOŚCI TAŚMY ---
  useEffect(() => {
    const updateSizes = () => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const trackWidth = trackRef.current?.scrollWidth ?? 0;
      setMaxOffset(Math.max(0, trackWidth - containerWidth));
    };

    updateSizes();
    window.addEventListener('resize', updateSizes);
    return () => window.removeEventListener('resize', updateSizes);
  }, [albums.length]);

  useEffect(() => {
    speedRef.current = speedFactor;
  }, [speedFactor]);

  useEffect(() => {
    if (selectedDot !== null) {
      setSpeedFactor(0);
    } else if (isHovering) {
      setSpeedFactor(0.35);
    } else {
      setSpeedFactor(1);
    }
  }, [selectedDot, isHovering]);

  useEffect(() => {
    if (maxOffset <= 0) {
      x.set(0);
      directionRef.current = 1;
      return;
    }

    const current = x.get();
    if (current < -maxOffset) {
      x.set(-maxOffset);
      directionRef.current = -1;
    } else if (current > 0) {
      x.set(0);
      directionRef.current = 1;
    }
  }, [maxOffset, x]);

  // --- MARQUEE (NAPRZEMIENNIE) ---
  useAnimationFrame((_t, delta) => {
    if (maxOffset <= 0) return;

    const dt = delta / 1000;
    const speed = BASE_SPEED_PX_PER_SEC * speedRef.current;
    const dir = directionRef.current;
    let next = x.get() - dir * speed * dt;

    if (next <= -maxOffset) {
      next = -maxOffset;
      directionRef.current = -1;
    } else if (next >= 0) {
      next = 0;
      directionRef.current = 1;
    }

    x.set(next);
  });

  // --- RENDEROWANIE ---
  if ((!albums || albums.length === 0) && (!singles || singles.length === 0)) {
    return (
        <section className="mb-12">
            
            <div className="text-center py-10 text-gray-500">Ładowanie...</div>
        </section>
    );
  }

  return (
    <section className="mb-12">
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8">
        {/* LEFT: TOP 10 ALBUMS (STATIC, COMPACT) */}
        <div className="relative">
          <h3 className="text-lg font-semibold mb-3 text-center tracking-[0.10em] uppercase text-[#6ef3ff] drop-shadow-[0_0_12px_rgba(110,243,255,0.55)]">
            Albumy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {albums.slice(0, 10).map((album, i) => (
              <div
                key={album.id}
                onClick={() => router.push(`/album/${album.id}`)}
                className="relative flex items-center gap-3 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-white/10 p-3 cursor-pointer hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
              >
                <div className="absolute -top-2 -left-2 z-10 h-6 w-6 rounded-full bg-yellow-400 text-black text-xs font-bold flex items-center justify-center shadow">
                  {i + 1}
                </div>
                {album.cover_url ? (
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-white/10" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">{album.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {album.artist_name ?? "Nieznany artysta"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    ⭐ {album.avg_rating ?? "—"}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {album.votes ?? 0} głosów
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center">
          <div className="h-full w-px bg-white/10 dark:bg-white/10" />
        </div>

        {/* RIGHT: TOP 10 SINGLES */}
        <div className="relative">
          <h3 className="text-lg font-semibold mb-3 text-center tracking-[0.10em] uppercase text-[#ff7ad9] drop-shadow-[0_0_12px_rgba(255,122,217,0.55)]">
            Single
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...singles]
              .sort((a, b) => {
                const av = Number(a.avg_rating ?? 0);
                const bv = Number(b.avg_rating ?? 0);
                if (bv !== av) return bv - av;
                const avotes = Number(a.votes ?? 0);
                const bvotes = Number(b.votes ?? 0);
                return bvotes - avotes;
              })
              .slice(0, 10)
              .map((track, i) => (
              <div
                key={track.id}
                onClick={() => router.push(`/track/${track.id}`)}
                className="flex items-center gap-3 rounded-lg bg-white/70 dark:bg-white/5 border border-gray-300 dark:border-white/10 p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:bg-white/80 dark:hover:bg-white/10"
              >
                <div className="relative">
                  <div className="absolute -top-2 -left-2 z-10 h-6 w-6 rounded-full bg-yellow-400 text-black text-xs font-bold flex items-center justify-center shadow">
                    {i + 1}
                  </div>
                  {track.cover_url ? (
                    <img
                      src={track.cover_url}
                      alt={track.title}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-white/10" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">{track.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {track.artist_name ?? "Nieznany artysta"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    ⭐ {track.avg_rating ?? "—"}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {track.votes ?? 0} głosów
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
