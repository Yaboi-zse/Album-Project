// pages/album/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Track = {
  id?: string;
  title?: string;
  duration?: number;
  spotify_url?: string | null;
  track_number?: number;
};

function isUrlCandidate(s?: string | null) {
  if (!s) return false;
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(s.trim());
}

function stripHtmlButKeepText(html?: string | null) {
  if (!html) return "";
  // Usuń linki, zostaw ich tekst, potem usuń pozostałe tagi
  const withoutAnchors = html.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  // Zamień <br> i </p> na nowe linie, żeby zachować podziały
  const withBreaks = withoutAnchors.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  // Usuń pozostałe tagi
  const plain = withBreaks.replace(/<\/?[^>]+(>|$)/g, "");
  // dekodowanie encji prostym sposobem
  const txt = plain.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return txt.trim();
}

export default function AlbumDetails() {
  const router = useRouter();
  const { id } = router.query;
  const albumId = typeof id === "string" ? id : Array.isArray(id) && id.length > 0 ? id[0] : undefined;

  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState<{ title: string; body: string }>({ title: "", body: "" });
  const [showTracks, setShowTracks] = useState(false);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const fetchSpotifyTracks = useCallback(async (spotifyAlbumId?: string) => {
    if (!spotifyAlbumId) {
      setTracks([]);
      return;
    }
    try {
      const res = await fetch(`/api/spotify/tracks?album_id=${encodeURIComponent(spotifyAlbumId)}`);
      if (!res.ok) {
        console.warn("Spotify tracks fetch failed:", await res.text());
        setTracks([]);
        return;
      }
      const data = await res.json();
      setTracks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchSpotifyTracks error:", err);
      setTracks([]);
    }
  }, []);

  const fetchAndSaveSpotifyId = useCallback(
    async (title?: string, artist?: string, localAlbumId?: string) => {
      if (!title || !artist || !localAlbumId) return null;
      try {
        const res = await fetch(
          `/api/spotify/search?album=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        const found = data?.albums?.items?.[0] ?? data?.items?.[0] ?? null;
        if (!found) return null;
        const spotifyId = found.id ?? found.album?.id ?? null;
        if (spotifyId) {
          try {
            await supabase.from("albums").update({ spotify_id: spotifyId }).eq("id", localAlbumId);
          } catch (e) {
            console.warn("Could not save spotify_id:", e);
          }
          return spotifyId;
        }
        return null;
      } catch (err) {
        console.error("fetchAndSaveSpotifyId error:", err);
        return null;
      }
    },
    []
  );

const fetchAlbum = useCallback(
  async (autoFetchTracks = true) => {
    if (!albumId) return;
    setLoading(true);

    try {
      const { data: albumData, error } = await supabase
        .from("albums")
        .select(`
          id,
          title,
          year,
          genre,
          description,
          description_original,
          cover_url,
          spotify_id,
          artist_id,
          artist_name,
          artists(name)
        `)
        .eq("id", albumId)
        .maybeSingle();

      if (error || !albumData) {
        console.error("Błąd pobierania albumu:", error);
        setAlbum(null);
        setLoading(false);
        return;
      }

      const artistName =
        albumData.artist_name ??
        albumData.artists?.name ??
        null;

      setAlbum(albumData);

      // 🔥 ZADBAJ O SPOTIFY ID
      let spotifyId = albumData.spotify_id ?? null;
      if (!spotifyId && autoFetchTracks && artistName && albumData.title) {
        try {
          const foundId = await fetchAndSaveSpotifyId(albumData.title, artistName, albumData.id);
          if (foundId) {
            spotifyId = foundId;
            setAlbum(prev => ({ ...(prev ?? {}), spotify_id: foundId }));
          }
        } catch (e) {
          console.warn("fetchAndSaveSpotifyId failed:", e);
        }
      }

      if (spotifyId && autoFetchTracks) {
        await fetchSpotifyTracks(spotifyId);
      }

      // ----------------------------------------------
      // 🔥 LAST.FM OPIS — PRIORYTET
      // ----------------------------------------------

      const cleanText = (html: string) => {
        if (!html) return "";
        const noAnchors = html.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
        const withBreaks = noAnchors
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n");

        let plain = withBreaks.replace(/<\/?[^>]+>/g, "");

        // usuń fragmenty Last.fm
        plain = plain.replace(/Read more on Last\.fm[\s\S]*$/i, "");
        plain = plain.replace(/User-contributed text[\s\S]*$/i, "");
        plain = plain.replace(/additional terms may apply\.*$/i, "");

        // dekoduj
        plain = plain
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        return plain.trim();
      };

      const descIsUrl = isUrlCandidate(albumData.description);
      const descriptionMissing =
        !albumData.description ||
        descIsUrl ||
        albumData.description.trim().length < 5;

      let finalOriginal = albumData.description_original || null;
      let finalTranslated = albumData.description || null;

      // 🔥 pobierz Last.fm jeśli brakuje opisu
      if (descriptionMissing && albumData.title && artistName) {
        try {
          const res = await fetch(
            `/api/lastfm/album?title=${encodeURIComponent(albumData.title)}&artist=${encodeURIComponent(
              artistName
            )}&target_lang=pl`
          );

          if (res.ok) {
            const json = await res.json();

            const srcOriginal = json?.description_original ?? "";
            const srcTranslated = json?.description_translated ?? "";

            const cleanedOriginal = cleanText(srcOriginal);
            const cleanedTranslated = cleanText(srcTranslated);

            finalOriginal = cleanedOriginal || null;
            finalTranslated = cleanedTranslated || cleanedOriginal || null;
          }
        } catch (err) {
          console.error("LastFM fetch error:", err);
        }
      }

      // ----------------------------------------------
      // 🔥 FALLBACK jeśli dalej brak opisu
      // ----------------------------------------------
      if (!finalTranslated) finalTranslated = "Brak opisu albumu.";
      if (!finalOriginal) finalOriginal = "Brak oryginalnego opisu.";

      // 🔥 USTAW W UI
      setAlbum(prev => ({
        ...(prev ?? {}),
        description: finalTranslated,
        description_original: finalOriginal
      }));

      // ----------------------------------------------
      // OCENY / USER / FAVORITES
      // ----------------------------------------------

      const { data: ratings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("album_id", albumId);

      if (ratings?.length) {
        const avg =
          ratings.reduce((s, r) => s + Number(r.rating), 0) /
          ratings.length;
        setAvgRating(Number(avg.toFixed(1)));
      } else setAvgRating(null);

      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: userRatingData } = await supabase
          .from("ratings")
          .select("rating")
          .eq("user_id", currentUser.id)
          .eq("album_id", albumId)
          .maybeSingle();

        setUserRating(userRatingData?.rating ?? null);

        const { data: favData } = await supabase
          .from("favorites")
          .select("album_id")
          .eq("user_id", currentUser.id)
          .eq("album_id", albumId)
          .maybeSingle();

        setIsFavorite(!!favData);
      }

    } catch (err) {
      console.error("fetchAlbum error:", err);
      setAlbum(null);
    } finally {
      setLoading(false);
    }
  },
  [albumId, fetchAndSaveSpotifyId, fetchSpotifyTracks]
);
  useEffect(() => {
    if (!albumId) return;
    fetchAlbum(true);
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };
    init();

    if (!albumId) return;

    const channel = supabase
      .channel("reviews-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => fetchReviews())
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

  async function fetchReviews() {
    if (!albumId) return;
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        id,
        title,
        body,
        created_at,
        user_id,
        profiles ( username, avatar_url )
      `)
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
          .update({ title: newReview.title, body: newReview.body, created_at: new Date().toISOString() })
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
        await supabase.from("ratings").update({ rating, created_at: new Date().toISOString() }).eq("id", existing.id);
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

  const plainDescription = useMemo(() => stripHtmlButKeepText(album?.description), [album?.description]);

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
        <Link href="/" className="text-blue-500 hover:underline mb-8 inline-flex items-center gap-1">
          ← Powrót
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_360px] gap-10 items-start">
          {/* left */}
          <div className="flex flex-col items-center">
            <img src={album?.cover_url || "/placeholder.png"} alt={album?.title || "Brak tytułu"} className="w-64 h-64 rounded-2xl shadow-xl object-cover mb-6 border border-gray-200 dark:border-gray-700" />
            <div className="w-64 flex flex-wrap justify-center gap-2 mb-5">
              {[...Array(10)].map((_, i) => {
                const rating = i + 1;
                const isActive = !!userRating && rating <= userRating;
                return (
                  <button key={rating} onClick={() => handleRating(rating)} title={userRating === rating ? `Twoja ocena: ${userRating}/10` : `Oceń na ${rating}/10`} className={`w-9 h-9 rounded-full font-semibold text-sm flex items-center justify-center transition-all duration-200 shadow-sm border border-transparent ${isActive ? "bg-yellow-400 text-black scale-110 shadow-yellow-400/30 border-yellow-500" : "bg-gray-200 dark:bg-[#1e242b] text-gray-800 dark:text-gray-300 hover:bg-yellow-300 hover:text-black"}`}>
                    {rating}
                  </button>
                );
              })}
            </div>
            <button onClick={toggleFavorite} className={`text-3xl transition-transform hover:scale-110 ${isFavorite ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}>{isFavorite ? "❤️" : "🤍"}</button>
          </div>

          {/* center */}
          <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 flex flex-col min-h-[200px] md:min-h-80 overflow-y-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{album?.title || "Brak tytułu"}</h1>

            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">{album?.artist_name ?? album?.artists?.name ?? "Nieznany artysta"}</p>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Rok wydania: {album?.year ?? "Nieznany"}</p>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Gatunek: {album?.genre ?? "—"}</p>
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Opis albumu</p>

            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {album.description?.trim() || "Brak opisu albumu."}
            </p>
          </div>
          </div>
          {/* right */}
          <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 max-h-[560px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-600 pb-2 mb-3">
              <h2 className="text-lg font-semibold">Lista utworów</h2>
              <button onClick={() => setShowTracks(s => !s)} className="text-sm text-blue-500 hover:underline">{showTracks ? "Ukryj" : "Pokaż"}</button>
            </div>

            {showTracks ? (
              tracks.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {tracks.map((t, i) => (
                    <li key={t.id ?? i} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                        <Link href={`/track/${t.id ?? ""}`} className="text-gray-700 dark:text-gray-300 hover:text-blue-500 transition">{t.title ?? "–"}</Link>
                      </div>
                      <div className="flex items-center gap-3">
                        {typeof t.duration === "number" && <span className="text-gray-500 text-xs">{Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, "0")}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Brak utworów dla tego albumu.</p>
              )
            ) : null}

            {album?.spotify_id && (
              <div className="mt-6 rounded-lg overflow-hidden">
                <iframe src={`https://open.spotify.com/embed/album/${album.spotify_id}`} width="100%" height="200" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
              </div>
            )}
          </div>
        </div>

        {/* Reviews (bez zmian) */}
        <div className="mt-12 bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-4">💬 Recenzje i komentarze</h2>

          {user && !editingReview && (
            <div className="mb-8 flex flex-col gap-3">
              <input type="text" value={newReview.title || ""} onChange={(e) => setNewReview((prev) => ({ ...prev, title: e.target.value }))} placeholder="Tytuł recenzji..." className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
              <textarea value={newReview.body || ""} onChange={(e) => setNewReview((prev) => ({ ...prev, body: e.target.value }))} placeholder="Treść recenzji..." className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none h-28" />
              <button onClick={addOrUpdateReview} className="self-start mt-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition">💬 Dodaj recenzję</button>
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
                  <motion.li key={rev.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, backgroundColor: isHighlighted ? "rgba(255, 245, 157, 0.32)" : "transparent" }} transition={{ duration: 0.35, backgroundColor: { duration: 1.2 } }} className="p-4 rounded-xl bg-gray-50 dark:bg-[#111418] border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <Link href={rev.profiles?.username ? `/user/${rev.profiles.username}` : `/user/${rev.user_id}`} className="flex items-center gap-2 group">
                        {rev.profiles?.avatar_url ? <img src={rev.profiles.avatar_url} alt={rev.profiles?.username || "Użytkownik"} className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700 group-hover:scale-105 transition-transform" /> : <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:scale-105 transition-transform" />}
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400 group-hover:underline">{rev.profiles?.username || "Użytkownik"}</p>
                      </Link>
                      <span className="text-xs text-gray-500">{new Date(rev.created_at).toLocaleString()}</span>
                    </div>

                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div key={`edit-${rev.id}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="flex flex-col gap-2 mt-2">
                          <input type="text" defaultValue={rev.title} onChange={(e) => setNewReview((prev) => ({ ...prev, title: e.target.value }))} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1c1f26] text-gray-900 dark:text-gray-100 text-sm" />
                          <textarea defaultValue={rev.body} onChange={(e) => setNewReview((prev) => ({ ...prev, body: e.target.value }))} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1c1f26] text-gray-900 dark:text-gray-100 text-sm resize-none h-24" />
                          <div className="flex gap-3 mt-1">
                            <button onClick={async () => { await addOrUpdateReview(); setEditingReview(null); setNewReview({ title: "", body: "" }); setReviews((prev) => prev.map((x) => (x.id === rev.id ? { ...x, justUpdated: true } : x))); setTimeout(() => setReviews((prev) => prev.map((x) => (x.id === rev.id ? { ...x, justUpdated: false } : x))), 1500); }} className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition">💾 Zapisz</button>
                            <button onClick={() => { setEditingReview(null); setNewReview({ title: "", body: "" }); }} className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium transition">✖ Anuluj</button>
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
                        <button onClick={() => { setEditingReview(rev.id); setNewReview({ title: rev.title || "", body: rev.body || "" }); }} className="text-blue-500 hover:underline">Edytuj</button>
                        <button onClick={() => deleteReview(rev.id)} className="text-red-500 hover:underline">Usuń</button>
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
