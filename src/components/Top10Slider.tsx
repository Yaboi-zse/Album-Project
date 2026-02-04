// src/components/Top10Slider.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimationFrame, useMotionValue } from 'framer-motion';
import { AlbumCards } from './AlbumCards';

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

interface Props {
  albums: Album[];
  onToggleFavorite: (albumId: string | number, isFavorite: boolean) => void;
  onRate: (albumId: string | number, value: number) => void;
}

const CARD_WIDTH = 240;
const CARD_GAP = 24; // gap-6
const BASE_SPEED_PX_PER_SEC = 40;

export function Top10Slider({ albums, onToggleFavorite, onRate }: Props) {
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
  if (!albums || albums.length === 0) {
    return (
        <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">🔥 Top 10 albumów</h2>
            <div className="text-center py-10 text-gray-500">Ładowanie...</div>
        </section>
    );
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">🔥 Top 10 albumów</h2>
      <div
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div
          ref={containerRef}
          className="overflow-hidden"
        >
          {/* Kontener na slajdy */}
          <motion.div
            ref={trackRef}
            className="flex gap-6 pb-8" // Padding na dole dla kropek
            style={{ x }}
          >
            {albums.map((album, i) => (
              <div key={album.id} className="relative" style={{ minWidth: CARD_WIDTH, width: CARD_WIDTH }}>
                <div className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-yellow-400 text-black text-sm font-bold flex items-center justify-center shadow">
                  {i + 1}
                </div>
                <AlbumCards
                  album={{ ...album, 'rank': i + 1 }}
                  onToggleFavorite={onToggleFavorite}
                  onRate={onRate}
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dots navigation */}
        {albums.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            {[0, 1].map((i) => {
              const isActive = selectedDot === i;
              return (
                <button
                  key={`dot-${i}`}
                  type="button"
                  aria-label={i === 0 ? "Początek" : "Koniec"}
                  onClick={() => {
                    const nextSelected = selectedDot === i ? null : i;
                    setSelectedDot(nextSelected);
                    if (nextSelected === null) return;
                    const target = i === 0 ? 0 : -maxOffset;
                    const current = x.get();
                    directionRef.current = target < current ? 1 : -1;
                    x.set(target);
                  }}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    isActive ? "bg-white/90 scale-110" : "bg-white/30 hover:bg-white/60"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
