// pages/album/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function AlbumDetails() {
  const router = useRouter();
  const { id } = router.query;
  // normalize id (could be string | string[] | undefined)
  const albumId =
    typeof id === "string" ? id : Array.isArray(id) && id.length > 0 ? id[0] : undefined;

  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState<{ title: string; body: string }>({
    title: "",
    body: "",
  });
  const [showTracks, setShowTracks] = useState(false);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

// 🎧 Pobieranie utworów z Spotify API (bez wymogu logowania)
async function fetchSpotifyTracks(spotifyAlbumId: string, id: string) {
    if (!spotifyAlbumId) {
    console.warn("⚠️ fetchSpotifyTracks: brak spotify_id — pomijam pobieranie.");
    return;
  }
  try {
    console.info("📡 Fetching tracks from Spotify:", spotifyAlbumId);
    const res = await fetch(`/api/spotify/tracks?album_id=${encodeURIComponent(album.spotify_id)}`);
    if (!res.ok) {
      console.error("❌ Błąd Spotify API:", await res.text());
      return;
    }
    const data = await res.json();
    console.log("✅ Pobrano utwory z Spotify:", data);
    setTracks(data || []);
  } catch (err) {
    console.error("fetchSpotifyTracks error:", err);
  }
}
async function fetchSpotifyAlbumId(title: string, artist: string) {
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(`${title} ${artist}`)}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Weź pierwszy wynik albumu
    const albumItem = data?.albums?.items?.[0];
    if (!albumItem) return null;

    // Zapisz do Supabase
    await supabase
      .from("albums")
      .update({ spotify_id: albumItem.id })
      .eq("id", album.id);

    console.log("🎧 Zapisano spotify_id:", albumItem.id);
    return albumItem.id;
  } catch (err) {
    console.error("Błąd przy wyszukiwaniu albumu w Spotify:", err);
    return null;
  }
}

  // 🔹 Pobierz album + recenzje po załadowaniu
useEffect(() => {
  if (id) {
    fetchAlbum(true); // automatycznie pobierze utwory ze Spotify jeśli brak lokalnych
    fetchReviews();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id]);
// w komponencie React
// 🎵 Pobieranie utworów z Spotify (jeśli mamy spotify_id)
useEffect(() => {
  async function loadTracks() {
    if (!album?.spotify_id) {
      console.warn("⚠️ Brak spotify_id — pomijam pobieranie utworów z API Spotify");
      return;
    }

    try {
      console.info("📡 Pobieranie utworów z Spotify ID:", album.spotify_id);
      const res = await fetch(`/api/spotify/tracks?album_id=${album.spotify_id}`);

      if (!res.ok) {
        console.error("Błąd Spotify API:", await res.text());
        return;
      }

      const data = await res.json();
      setTracks(data || []);
    } catch (err) {
      console.error("❌ loadTracks error:", err);
    }
  }

  if (album) loadTracks();
}, [album]);




  // 🔹 Pobierz użytkownika i subskrybuj realtime zmiany recenzji
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };
    init();

    if (!albumId) return;

    // 🔁 realtime nasłuchiwanie zmian recenzji
    const channel = supabase
      .channel("reviews-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () =>
        fetchReviews()
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

// 🔹 Główna funkcja pobierania danych albumu
async function fetchAlbum(autoFetchTracks = true) {
  setLoading(true);

  const { data: albumData, error } = await supabase
    .from("albums")
    .select("id, title, year, genre, description, cover_url, spotify_id, artist_id, artist_name, artists(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Błąd pobierania albumu:", error);
    setAlbum(null);
    setLoading(false);
    return;
  }

  if (!albumData) {
    setAlbum(null);
    setLoading(false);
    return;
  }

  setAlbum(albumData);
 // Jeśli brak spotify_id — spróbuj znaleźć album na Spotify
if (!albumData.spotify_id && albumData.title && albumData.artist_name || albumData.artists?.name
) {
  try {
    console.log("🔍 Szukam albumu na Spotify:", albumData.title, albumData.artist_name || albumData.artists?.name
);

    const res = await fetch(
      `/api/spotify/search?album=${encodeURIComponent(albumData.title)}&artist=${encodeURIComponent(
        albumData.artist_name || albumData.artists?.name
      )}`
    );

    if (res.ok) {
      const found = await res.json();

      // Zapisz spotify_id w Supabase
      await supabase
        .from("albums")
        .update({ spotify_id: found.spotify_id })
        .eq("id", albumData.id);

      // Zaktualizuj lokalny stan
      setAlbum((prev: any) => ({ ...prev, spotify_id: found.spotify_id }));
      console.log("✅ Spotify ID zapisane w bazie:", found.spotify_id);
    } else {
      console.warn("⚠️ Nie znaleziono albumu na Spotify:", await res.text());
    }
  } catch (err) {
    console.error("❌ Błąd podczas auto-wyszukiwania Spotify ID:", err);
  }
}




  // ⭐ Pobierz oceny
  const { data: ratings } = await supabase
    .from("ratings")
    .select("rating")
    .eq("album_id", id);

  if (ratings?.length) {
    const avg =
      ratings.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratings.length;
    setAvgRating(Number(avg.toFixed(1)));
  } else {
    setAvgRating(null);
  }

  // 👤 Użytkownik i ulubione
  const { data: userData } = await supabase.auth.getUser();
  const currentUser = userData?.user;
  setUser(currentUser ?? null);

  if (currentUser) {
    const { data: userRatingData } = await supabase
      .from("ratings")
      .select("rating")
      .eq("user_id", currentUser.id)
      .eq("album_id", id)
      .maybeSingle();

    setUserRating(userRatingData?.rating ?? null);

    const { data: favData } = await supabase
      .from("favorites")
      .select("album_id")
      .eq("user_id", currentUser.id)
      .eq("album_id", id)
      .maybeSingle();

    setIsFavorite(!!favData);
  } else {
    setUserRating(null);
    setIsFavorite(false);
  }

  // 🎵 Pobierz lokalne utwory z Supabase
  const { data: localTracks } = await supabase
    .from("tracks")
    .select("id, title, duration, spotify_url, preview_url, track_number")
    .eq("album_id", id)
    .order("track_number", { ascending: true });

  // Jeśli nie ma lokalnych utworów i mamy Spotify ID → spróbuj pobrać z API Spotify
if ((!localTracks || localTracks.length === 0) && autoFetchTracks) {
  if (albumData.spotify_id && currentUser) {
    console.log("🎧 Brak utworów w bazie — pobieram z Spotify...");
    await fetchSpotifyTracks(albumData.spotify_id, currentUser.id);
  } else {
    console.warn("⚠️ Pomijam pobieranie utworów — brak spotify_id lub użytkownika.");
  }
}


  setLoading(false);
}

  // Zapisywanie oceny
  async function handleRating(rating: number) {
    if (!user) {
      alert("Musisz być zalogowany, aby ocenić album.");
      return;
    }
    if (!albumId) return;

    try {
      const { data: existing } = await supabase
        .from("ratings")
        .select("id")
        .eq("user_id", user.id)
        .eq("album_id", albumId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ratings")
          .update({ rating, created_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ratings").insert({
          user_id: user.id,
          album_id: albumId,
          rating,
          created_at: new Date().toISOString(),
        });
      }

      setUserRating(rating);
      await fetchAlbum();
    } catch (err) {
      console.error("Błąd przy zapisie oceny:", err);
      alert("Nie udało się zapisać oceny.");
    }
  }

  async function toggleFavorite() {
    if (!user) {
      alert("Musisz być zalogowany, aby dodać do ulubionych.");
      return;
    }
    if (!albumId) return;

    try {
      if (isFavorite) {
        await supabase.from("favorites").delete().eq("album_id", albumId).eq("user_id", user.id);
      } else {
        await supabase.from("favorites").insert({ album_id: albumId, user_id: user.id });
      }

      setIsFavorite((s) => !s);
    } catch (err) {
      console.error("Błąd toggleFavorite:", err);
      alert("Coś poszło nie tak z ulubionymi.");
    }
  }

  async function fetchReviews() {
    if (!albumId) return;
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
      id,
      title,
      body,
      created_at,
      user_id,
      profiles ( username, avatar_url )
    `
      )
      .eq("album_id", albumId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Błąd przy pobieraniu recenzji:", error);
      setReviews([]);
    } else {
      setReviews(data || []);
    }
  }

  async function addOrUpdateReview() {
    if (!user) {
      alert("Musisz być zalogowany, aby dodać recenzję.");
      return;
    }
    if (!albumId) return;
    if (!newReview.title.trim() || !newReview.body.trim()) {
      alert("Uzupełnij tytuł i treść recenzji.");
      return;
    }

    try {
      if (editingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({
            title: newReview.title,
            body: newReview.body,
            created_at: new Date().toISOString(),
          })
          .eq("id", editingReview);

        if (error) throw error;
        setEditingReview(null);
      } else {
        const { error } = await supabase.from("reviews").insert({
          album_id: albumId,
          user_id: user.id,
          title: newReview.title,
          body: newReview.body,
        });

        if (error) throw error;
      }

      setNewReview({ title: "", body: "" });
      await fetchReviews();
    } catch (err) {
      console.error("Błąd przy dodawaniu/edycji recenzji:", err);
      alert("Nie udało się dodać/edytować recenzji. Sprawdź konsolę.");
    }
  }

  async function deleteReview(reviewId: string) {
    if (!confirm("Czy na pewno chcesz usunąć recenzję?")) return;
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (error) throw error;
      await fetchReviews();
    } catch (err) {
      console.error("Błąd przy usuwaniu recenzji:", err);
      alert("Nie udało się usunąć recenzji.");
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-400">
        <p>Ładowanie albumu...</p>
      </main>
    );
  }

  if (!album) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-400">
        <p>Nie znaleziono albumu.</p>
      </main>
    );
  }

  return (
    <main className="px-6 py-10 min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-900 dark:text-gray-100 transition-colors duration-500">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/"
          className="text-blue-500 hover:underline mb-8 inline-flex items-center gap-1"
        >
          ← Powrót
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr_300px] gap-10">
          {/* Okładka + oceny */}
          <div className="flex flex-col items-center">
            <img
              src={album?.cover_url || "/placeholder.png"}
              alt={album?.title || "Brak tytułu"}
              className="w-72 h-72 rounded-2xl shadow-xl object-cover mb-6 border border-gray-200 dark:border-gray-700"
            />

            {/* ⭐ Oceny (okrągłe przyciski) */}
            <div className="w-72 flex flex-wrap justify-center gap-2 mb-5">
              {[...Array(10)].map((_, i) => {
                const rating = i + 1;
                const isActive = userRating && rating <= userRating;

                return (
                  <button
                    key={rating}
                    onClick={() => handleRating(rating)}
                    title={
                      userRating === rating
                        ? `Twoja ocena: ${userRating}/10`
                        : `Oceń na ${rating}/10`
                    }
                    className={`w-9 h-9 rounded-full font-semibold text-sm flex items-center justify-center transition-all duration-200 shadow-sm border border-transparent
          ${
            isActive
              ? "bg-yellow-400 text-black scale-110 shadow-yellow-400/30 border-yellow-500"
              : "bg-gray-200 dark:bg-[#1e242b] text-gray-800 dark:text-gray-300 hover:bg-yellow-300 hover:text-black"
          }`}
                  >
                    {rating}
                  </button>
                );
              })}
            </div>

            <button
              onClick={toggleFavorite}
              className={`text-3xl transition-transform hover:scale-110 ${
                isFavorite ? "text-red-500" : "text-gray-400 hover:text-red-400"
              }`}
            >
              {isFavorite ? "❤️" : "🤍"}
            </button>
          </div>

          {/* Informacje */}
          <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8 flex flex-col justify-center">
            <h1 className="text-3xl font-bold mb-2">{album?.title || "Brak tytułu"}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              {album?.artists?.name || "Nieznany artysta"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Rok wydania: {album?.year || "Nieznany"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Gatunek: {album?.genre || "—"}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {album?.description || "Brak opisu albumu."}
            </p>
            <div className="mt-6 text-yellow-500 font-semibold">
              Średnia ocena: {avgRating ? `${avgRating.toFixed(1)}/10` : "—"}
            </div>
          </div>

{/* Utwory */}
<div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6">
  <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-600 pb-2 mb-3">
    <h2 className="text-lg font-semibold">Lista utworów</h2>
    <button
      onClick={() => setShowTracks((s) => !s)}
      className="text-sm text-blue-500 hover:underline"
    >
      {showTracks ? "Ukryj" : "Pokaż"}
    </button>
  </div>

  {showTracks && (
    <>
      {tracks.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {tracks.map((t, i) => (
            <li
              key={t.id || i}
              className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                <Link
                  href={`/track/${t.id}`}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 transition"
                >
                  {t.title}
                </Link>
              </div>
              <div className="flex items-center gap-3">
                {t.duration && (
                  <span className="text-gray-500 text-xs">
                    {Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, "0")}
                  </span>
                )}
                {t.spotify_url && (
                  <a
                    href={t.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:text-green-400 text-lg"
                    title="Otwórz w Spotify"
                  >
                    ▶️
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Brak utworów dla tego albumu.
        </p>
      )}
    </>
  )}

  {/* 🎧 Player Spotify */}
  {album.spotify_id && (
    <div className="mt-6 rounded-lg overflow-hidden">
      <iframe
        src={`https://open.spotify.com/embed/album/${album.spotify_id}`}
        width="100%"
        height="200"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </div>
  )}
</div>
</div>
        {/* Recenzje */}
        <div className="mt-12 bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-4">💬 Recenzje i komentarze</h2>

          {/* Formularz dodawania nowej recenzji (ukryty podczas inline edycji) */}
          {user && !editingReview && (
            <div className="mb-8 flex flex-col gap-3">
              <input
                type="text"
                value={newReview.title || ""}
                onChange={(e) =>
                  setNewReview((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="Tytuł recenzji..."
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newReview.body || ""}
                onChange={(e) =>
                  setNewReview((prev) => ({
                    ...prev,
                    body: e.target.value,
                  }))
                }
                placeholder="Treść recenzji..."
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none h-28"
              />
              <button
                onClick={addOrUpdateReview}
                className="self-start mt-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
              >
                💬 Dodaj recenzję
              </button>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Brak recenzji. Bądź pierwszym, który coś napisze!</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((rev) => {
                const isUserReview = user?.id === rev.user_id;
                const isEditing = editingReview === rev.id;
                const isHighlighted = !!rev.justUpdated;

                return (
                  <motion.li
                    key={rev.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      backgroundColor: isHighlighted ? "rgba(255, 245, 157, 0.32)" : "transparent",
                    }}
                    transition={{ duration: 0.35, backgroundColor: { duration: 1.2 } }}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-[#111418] border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={
                          rev.profiles?.username ? `/user/${rev.profiles.username}` : `/user/${rev.user_id}`
                        }
                        className="flex items-center gap-2 group"
                      >
                        {rev.profiles?.avatar_url ? (
                          <img
                            src={rev.profiles.avatar_url}
                            alt={rev.profiles?.username || "Użytkownik"}
                            className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:scale-105 transition-transform" />
                        )}
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400 group-hover:underline">
                          {rev.profiles?.username || "Użytkownik"}
                        </p>
                      </Link>

                      <span className="text-xs text-gray-500">{new Date(rev.created_at).toLocaleString()}</span>
                    </div>

                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div
                          key={`edit-${rev.id}`}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.22 }}
                          className="flex flex-col gap-2 mt-2"
                        >
                          <input
                            type="text"
                            defaultValue={rev.title}
                            onChange={(e) => setNewReview((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1c1f26] text-gray-900 dark:text-gray-100 text-sm"
                          />
                          <textarea
                            defaultValue={rev.body}
                            onChange={(e) => setNewReview((prev) => ({ ...prev, body: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1c1f26] text-gray-900 dark:text-gray-100 text-sm resize-none h-24"
                          />
                          <div className="flex gap-3 mt-1">
                            <button
                              onClick={async () => {
                                await addOrUpdateReview();
                                setEditingReview(null);
                                setNewReview({ title: "", body: "" });
                                setReviews((prev) => prev.map((x) => (x.id === rev.id ? { ...x, justUpdated: true } : x)));
                                setTimeout(() => {
                                  setReviews((prev) => prev.map((x) => (x.id === rev.id ? { ...x, justUpdated: false } : x)));
                                }, 1500);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition"
                            >
                              💾 Zapisz
                            </button>

                            <button
                              onClick={() => {
                                setEditingReview(null);
                                setNewReview({ title: "", body: "" });
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium transition"
                            >
                              ✖ Anuluj
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key={`view-${rev.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{rev.title || "Bez tytułu"}</h3>
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{rev.body}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isUserReview && !isEditing && (
                      <div className="flex gap-3 mt-3 text-xs">
                        <button
                          onClick={() => {
                            setEditingReview(rev.id);
                            setNewReview({ title: rev.title || "", body: rev.body || "" });
                          }}
                          className="text-blue-500 hover:underline"
                        >
                          Edytuj
                        </button>
                        <button onClick={() => deleteReview(rev.id)} className="text-red-500 hover:underline">
                          Usuń
                        </button>
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
