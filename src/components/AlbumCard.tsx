"use client";
import { motion } from "framer-motion";
import Link from "next/link";

interface AlbumCardProps {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string;
  avg_rating: string;
  votes: number;
  is_favorite: boolean;
  onFavoriteToggle?: () => void;
}

export default function AlbumCard({
  id,
  title,
  artist_name,
  cover_url,
  avg_rating,
  votes,
  is_favorite,
  onFavoriteToggle,
}: AlbumCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md overflow-hidden border border-gray-100 dark:border-gray-700"
    >
      <Link href={`/album/${id}`} className="w-full h-full">
        <img
          src={cover_url || "https://placehold.co/300x300?text=No+Cover"}
          alt={title}
          className="w-full h-60 object-cover"
        />
        <div className="p-4">
          <h3 className="font-semibold truncate">{title}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{artist_name}</p>
          <p className="text-yellow-500 text-sm mt-1">
            ⭐ {avg_rating} <span className="text-xs text-gray-400">({votes})</span>
          </p>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFavoriteToggle?.();
        }}
        className={`absolute top-3 right-3 text-2xl transition-transform ${
          is_favorite ? "text-red-500" : "text-gray-400 hover:scale-110"
        }`}
      >
        {is_favorite ? "❤️" : "🤍"}
      </button>
    </motion.div>
  );
}
