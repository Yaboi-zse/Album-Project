// pages/album/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RATING_COLORS } from "../../styles/theme";

const FALLBACK_BG = "/mnt/data/e4520bdf-552d-47a4-93b6-d3df905166b3.png";

type Track = {
  id?: string;
  title?: string;
  duration?: number;
  spotify_url?: string | null;
  preview_url?: string | null;
};

export default function AlbumDetails() {
  const router = useRouter();
  const { id } = router.query;
  const albumId = typeof id === "string" ? id : undefined;

  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [showTracks, setShowTracks] = useState(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState({ title: "", body: "" });
  const [editingReview, setEditingReview] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hoveredRatingValue, setHoveredRatingValue] = useState<number | null>(null);
  const [ratingCounts, setRatingCounts] = useState<number[]>(Array(10).fill(0));
  const [ratingTotal, setRatingTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const cleanDescription = (text?: string) => {
    if (!text) return "";
    return text
      .replace(/https?:\/\/open\.spotify\.com\/album\/[A-Za-z0-9]+(\?\S+)?/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  // --------- Fetch Spotify tracks ---------
  const fetchSpotifyTracks = useCallback(async (spotifyAlbumId?: string) => {
    if (!spotifyAlbumId) return setTracks([]);

    try {
      const res = await fetch(`/api/spotify/tracks?album_id=${spotifyAlbumId}`);
      const data = await res.json();
      setTracks(Array.isArray(data) ? data : []);
    } catch {
      setTracks([]);
    }
  }, []);

  // --------- Fetch album ---------
  const fetchAlbum = useCallback(async () => {
    if (!albumId) return;

    setLoading(true);

    try {
      const { data } = await supabase
        .from("albums")
        .select(
          `
          id, title, year, genre, description, cover_url, spotify_id,
          artist_id, artist_name,
          artists(id, name)
        `
        )
        .eq("id", albumId)
        .maybeSingle();

      if (!data) {
        setAlbum(null);
        setLoading(false);
        return;
      }

      const artistName =
        data.artist_name ?? (data.artists && (data.artists as any).name) ?? null;
      const artistId =
        data.artist_id ?? (data.artists && (data.artists as any).id) ?? null;
      setAlbum({ ...data, artist_name: artistName, artist_id: artistId });

      if (data.spotify_id) fetchSpotifyTracks(data.spotify_id);

      // Ratings
      const { data: ratings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("album_id", albumId);

      if (ratings?.length) {
        const avg =
          ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length;
        setAvgRating(Number(avg.toFixed(1)));
        const counts = Array(10).fill(0) as number[];
        ratings.forEach((r) => {
          const value = Number(r.rating);
          if (value >= 1 && value <= 10) counts[value - 1] += 1;
        });
        setRatingCounts(counts);
        setRatingTotal(ratings.length);
      } else {
        setRatingCounts(Array(10).fill(0));
        setRatingTotal(0);
      }

      // User data
      const { data: u } = await supabase.auth.getUser();
      const currentUser = u?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: ur } = await supabase
          .from("ratings")
          .select("rating")
          .eq("user_id", currentUser.id)
          .eq("album_id", albumId)
          .maybeSingle();

        setUserRating(ur?.rating ?? null);

        const { data: fav } = await supabase
          .from("favorites")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("album_id", albumId)
          .maybeSingle();

        setIsFavorite(!!fav);
      }
    } finally {
      setLoading(false);
    }
  }, [albumId, fetchSpotifyTracks]);

  // --------- Fetch reviews ---------
  const fetchReviews = async () => {
    if (!albumId) return;

    const { data } = await supabase
      .from("reviews")
      .select(`
        id, title, body, created_at, user_id,
        profiles(username, avatar_url)
      `)
      .eq("album_id", albumId)
      .order("created_at", { ascending: false });

    setReviews(data || []);
  };

  // --------- Init ---------
  useEffect(() => {
    fetchAlbum();
    fetchReviews();
  }, [albumId]);

    useEffect(() => {
      const channel = supabase
        .channel("reviews-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, fetchReviews)
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, []);

  // --------- Rating ---------
  async function handleRating(rating: number) {
    if (!user) return alert("Musisz być zalogowany.");
    if (!albumId) return;

    const { data: exists } = await supabase
      .from("ratings")
      .select("id")
      .eq("user_id", user.id)
      .eq("album_id", albumId)
      .maybeSingle();

    if (exists) {
      await supabase
        .from("ratings")
        .update({ rating })
        .eq("id", exists.id);
    } else {
      await supabase.from("ratings").insert({
        rating,
        album_id: albumId,
        user_id: user.id,
      });
    }

    setUserRating(rating);
    fetchAlbum();
  }

  // --------- Favorites ---------
  async function toggleFavorite() {
    if (!user) return alert("Musisz być zalogowany.");
    if (!albumId) return;

    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("album_id", albumId)
        .eq("user_id", user.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorites").insert({
        album_id: albumId,
        user_id: user.id,
      });
      setIsFavorite(true);
    }
  }

  // --------- Reviews ---------
  async function addOrUpdateReview() {
    if (!user) return alert("Musisz być zalogowany.");
    if (!albumId) return;

    if (editingReview) {
      await supabase
        .from("reviews")
        .update(newReview)
        .eq("id", editingReview);
    } else {
      await supabase.from("reviews").insert({
        ...newReview,
        album_id: albumId,
        user_id: user.id,
      });
    }

    setEditingReview(null);
    setNewReview({ title: "", body: "" });
    fetchReviews();
  }

  async function deleteReview(id: string) {
    await supabase.from("reviews").delete().eq("id", id);
    fetchReviews();
  }

  // --------- Loading ---------
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        Ładowanie...
      </div>
    );

  if (!album)
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        Nie znaleziono albumu.
      </div>
    );

  // --------- UI ---------
return (
  <main
    className="
      min-h-screen 
      relative 
      bg-gray-100 text-black 
      dark:bg-[#03060a] dark:text-white
    "
  >
    {/* Blurred background */}
    <div
      className="
        absolute inset-0 
        bg-cover bg-center 
        blur-3xl 
        opacity-25
        dark:opacity-20
        pointer-events-none
      "
      style={{
        backgroundImage: `url("${album.cover_url || FALLBACK_BG}")`,
      }}
    />

    {/* Overlay to improve readability */}
    <div
      className="
        absolute inset-0 
        bg-white/50 
        dark:bg-black/40 
        pointer-events-none
      "
    />

    {/* CONTENT */}
    <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
      <button
        onClick={() => router.back()}
        className="mb-6 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
      >
        ← Powrót
      </button>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">

        {/* LEFT PANEL */}
        <aside className="h-full flex flex-col space-y-6">

          <img
            src={album.cover_url || FALLBACK_BG}
            className="rounded-xl shadow-xl"
          />

          <div className="p-4 rounded-xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10 h-full relative">
            <h3 className="text-lg font-semibold mb-2">🎵 Informacje</h3>
            <p className="font-bold text-black dark:text-white">{album.title}</p>

            <p className="text-sm mt-2">
              Artysta:{" "}
              <Link
                href={`/artist/${album.artist_id}`}
                className="text-blue-300 hover:underline"
              >
                {album.artist_name}
              </Link>
            </p>

            <p className="text-sm">Rok: {album.year ?? "—"}</p>
            <p className="text-sm">Gatunek: {album.genre ?? "—"}</p>

            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-3">
                <span>⭐ {avgRating ?? "—"}</span>
                <button
                  onClick={toggleFavorite}
                  className={`px-3 py-1 rounded-lg ${
                    isFavorite ? "bg-pink-600" : "bg-white/10"
                  }`}
                >
                  {isFavorite ? "❤️ Ulubione" : "Ulubione"}
                </button>
              </div>
            </div>
            <div className="absolute top-4 right-4 flex items-end gap-1 h-14 group">
              {ratingCounts.map((count, idx) => {
                const max = Math.max(1, ...ratingCounts);
                const height = Math.max(3, Math.round((count / max) * 48));
                return (
                  <div
                    key={`rating-bar-${idx}`}
                    style={{
                      height: `${height}px`,
                      background: RATING_COLORS[idx + 1],
                      opacity: count ? 1 : 0.3,
                    }}
                    className="w-2.5 rounded-sm transition-transform duration-150 group-hover:scale-y-110 group-hover:brightness-110"
                  />
                );
              })}
              <div className="pointer-events-none absolute -top-7 right-0 rounded-md bg-black/80 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Liczba ocen: {ratingTotal}, ocena: {avgRating ?? "—"}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm mb-2">Twoja ocena:</p>
              <div
                className="grid grid-cols-10 gap-1.5 w-full"
                onMouseLeave={() => setHoveredRatingValue(null)}
              >
                {Array.from({ length: 10 }).map((_, idx) => {
                  const value = idx + 1;
                  const isActive = userRating === value;
                  const isHighlighted = hoveredRatingValue !== null && value <= hoveredRatingValue;

                  return (
                    <button
                      key={value}
                      type="button"
                      onMouseEnter={() => setHoveredRatingValue(value)}
                      onClick={() => handleRating(value)}
                      style={{
                        background: isActive
                          ? RATING_COLORS[value]
                          : isHighlighted
                          ? `${RATING_COLORS[value]}33`
                          : "rgba(255,255,255,0.08)",
                        border: `1px solid ${isActive || isHighlighted ? RATING_COLORS[value] : "rgba(255,255,255,0.2)"}`,
                        transform: isActive ? "scale(1.15)" : isHighlighted ? "scale(1.08)" : "scale(1)",
                        boxShadow: isActive ? `0 0 12px ${RATING_COLORS[value]}` : "none",
                        transition: "all 100ms ease",
                      }}
                      className="aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <section className="lg:col-span-2 h-full flex flex-col space-y-6">

          {/* DESCRIPTION */}
          <div className="p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-3xl font-bold">{album.title}</h1>

            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-line">
              {cleanDescription(album.description)}
            </p>
          </div>

          {/* TRACKLIST */}
          <div className="p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Lista utworów</h3>
              <button
                onClick={() => setShowTracks((s) => !s)}
                className="text-sm text-blue-300"
              >
                {showTracks ? "Ukryj" : "Pokaż"}
              </button>
            </div>
          {showTracks && (
            <ol className="space-y-3 mb-6">
              {tracks.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-white/5 dark:bg-white/10 rounded-lg p-3 hover:bg-white/20 transition-colors cursor-pointer"
                  onClick={() => {
                    if (t.id) {
                      router.push(`/track/${t.id}`);
                    } else if (t.spotify_url) {
                      window.open(t.spotify_url, '_blank');
                    }
                  }}
                >
                  <span className="flex items-center gap-3 flex-1">
                    <span className="text-xs text-gray-400 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-black dark:text-white">{t.title}</span>
                  </span>

                  <div className="flex items-center gap-4">
                    {t.preview_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Zapobiega kliknięciu na cały element
                          const previewUrl = t.preview_url;
                          if (!previewUrl) return;
                          const audio = new Audio(previewUrl);
                          audio.play();
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        ▶️ Odsłuchaj
                      </button>
                    )}
                    
                    <span className="text-xs text-gray-400">
                      {t.duration
                        ? `${Math.floor(t.duration / 60)}:${String(
                            t.duration % 60
                          ).padStart(2, "0")}`
                        : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}

            <h4 className="font-semibold mb-3">Spotify</h4>

            {album.spotify_id ? (
              <iframe
                src={`https://open.spotify.com/embed/album/${album.spotify_id}`}
                width="100%"
                height="380"
                className="rounded-lg"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
            ) : (
              <p className="text-sm text-gray-400">Brak odtwarzacza Spotify.</p>
            )}
          </div>
        </section>
      </div>

      {/* REVIEWS */}
      <div className="mt-10 p-6 bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">💬 Recenzje</h2>

        {user && !editingReview && (
          <div className="mb-6">
            <input
              value={newReview.title}
              onChange={(e) =>
                setNewReview({ ...newReview, title: e.target.value })
              }
              placeholder="Tytuł"
              className="w-full p-3 bg-black/20 rounded mb-2"
            />
            <textarea
              value={newReview.body}
              onChange={(e) =>
                setNewReview({ ...newReview, body: e.target.value })
              }
              placeholder="Treść recenzji"
              className="w-full p-3 bg-black/20 rounded mb-2 h-28"
            />

            <button
              onClick={addOrUpdateReview}
              className="px-4 py-2 bg-purple-600 rounded"
            >
              Dodaj recenzję
            </button>
          </div>
        )}

        {reviews.map((r) => (
          <div
            key={r.id}
            className="p-4 rounded-xl bg-white/70 border border-gray-300 shadow dark:bg-black/20 dark:border-white/10"
          >
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={r.profiles?.avatar_url || FALLBACK_BG}
                  className="w-8 h-8 rounded"
                />
                <div>
                  <p className="font-bold text-xl">
                    {r.profiles?.username || "Użytkownik"}
                  </p>
                  <p className="text-xs font-bold text-black dark:text-white">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {user?.id === r.user_id && (
                <button
                  onClick={() => deleteReview(r.id)}
                  className="text-red-400 text-xs"
                >
                  Usuń
                </button>
              )}
            </div>

            <p className="text-xl font-bold mt-3">{r.title}</p>
            <p className="text-sm text-black dark:text-white">
              {r.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </main>
)}
