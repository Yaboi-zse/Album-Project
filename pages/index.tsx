// pages/index.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../src/lib/supabaseClient";
import { motion } from "framer-motion";

function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function HomePage() {
  const router = useRouter();

  // data
  const [albums, setAlbums] = useState<any[]>([]);
  const [top10Albums, setTop10Albums] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(0);
  const [artists, setArtists] = useState<any[]>([]);

  // filters / pagination
  const [search, setSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [ratingMin, setRatingMin] = useState<number | "">("");
  const [sortBy, setSortBy] = useState("title");
  const [page, setPage] = useState(1);
  const limit = 20;
  const debouncedSearch = useDebounced(search, 400);

  // slider config/state
  const CARD_WIDTH = 240;
  const GAP = 24;
  const SLIDE_SIZE = CARD_WIDTH + GAP;
  const [visibleCount, setVisibleCount] = useState(4);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setPaused] = useState(false);
  const TRANSITION_MS = 420;

  // hover
  const [hoveredRatingAlbum, setHoveredRatingAlbum] = useState<string | number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const top10 = top10Albums || [];

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      let v = 4;
      if (w < 640) v = 1;
      else if (w < 900) v = 2;
      else if (w < 1200) v = 3;
      else if (w < 1600) v = 4;
      else v = 5;

      setVisibleCount(v);
      setContainerWidth(containerRef.current?.offsetWidth ?? window.innerWidth);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const max = Math.max(0, top10.length - visibleCount);
    setSlideIndex(s => Math.min(s, max));
  }, [top10.length, visibleCount]);

  useEffect(() => {
    if (isPaused) return;
    if (top10.length <= visibleCount) return;

    const id = setInterval(() => {
      setSlideIndex(s => {
        const max = Math.max(0, top10.length - visibleCount);
        return s >= max ? 0 : s + 1;
      });
    }, 3800);

    return () => clearInterval(id);
  }, [isPaused, top10.length, visibleCount]);

  const calcTranslate = () => {
    const visibleTotalWidth = visibleCount * CARD_WIDTH + (visibleCount - 1) * GAP;
    const centerOffset = Math.max(0, (containerWidth - visibleTotalWidth) / 2);
    return -slideIndex * SLIDE_SIZE + centerOffset;
  };

  // data fetching
  useEffect(() => {
    fetchArtists();
    fetchAlbums();
    fetchTop10Albums();
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [page, artistFilter, genreFilter, yearFrom, yearTo, ratingMin, debouncedSearch, sortBy]);

  useEffect(() => {
    const ch1 = supabase
      .channel("ratings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => {
        fetchAlbums();
        fetchTop10Albums();
      });

    const ch2 = supabase
      .channel("favorites-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, () => {
        fetchAlbums();
        fetchTop10Albums();
      });

    ch1.subscribe();
    ch2.subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  const updateURL = () => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (artistFilter) params.artist = artistFilter;
    if (genreFilter) params.genre = genreFilter;
    if (yearFrom) params.yearFrom = yearFrom;
    if (yearTo) params.yearTo = yearTo;
    if (ratingMin !== "") params.rmin = String(ratingMin);
    if (sortBy !== "title") params.sort = sortBy;
    if (page > 1) params.index = String(page);

    router.replace({ pathname: "/", query: params }, undefined, { shallow: true });
  };

  async function fetchArtists() {
    const { data } = await supabase.from("artists").select("id, name").order("name");
    setArtists(data || []);
  }

  async function fetchAlbums() {
    try {
      const p_offset = (page - 1) * limit;

      const { count: totalCount } = await supabase
        .from("albums")
        .select("*", { count: "exact", head: true });

      setTotal(totalCount ?? 0);

      let query = supabase
        .from("albums")
        .select(`id, title, year, cover_url, artist_id, artists(name)`)
        .range(p_offset, p_offset + limit - 1);

      if (artistFilter) query = query.eq("artist_id", artistFilter);
      if (genreFilter && genreFilter !== "__NO_GENRE__") query = query.eq("genre", genreFilter);
      if (debouncedSearch) query = query.ilike("title", `%${debouncedSearch}%`);

      if (sortBy === "title") query = query.order("title", { ascending: true });
      else if (sortBy === "year") query = query.order("year", { ascending: false });

      const { data: rows } = await query;

      if (!rows || rows.length === 0) {
        setAlbums([]);
        updateURL();
        return;
      }

      const ids = rows.map(r => r.id);

      const [{ data: ratings }, { data: favs }, { data: userData }] = await Promise.all([
        supabase.from("ratings").select("album_id, rating").in("album_id", ids),
        supabase.from("favorites").select("album_id").in("album_id", ids),
        supabase.auth.getUser(),
      ]);

      const user = userData?.user;
      let userRatings: any[] = [];
      let userFavs: any[] = [];

      if (user) {
        const [{ data: ur }, { data: uf }] = await Promise.all([
          supabase.from("ratings").select("album_id, rating").eq("user_id", user.id).in("album_id", ids),
          supabase.from("favorites").select("album_id").eq("user_id", user.id).in("album_id", ids),
        ]);

        userRatings = ur || [];
        userFavs = uf || [];
      }

      const ratingsByAlbum: Record<string, number[]> = {};
      (ratings || []).forEach(r => {
        ratingsByAlbum[r.album_id] = ratingsByAlbum[r.album_id] || [];
        ratingsByAlbum[r.album_id].push(Number(r.rating));
      });

      const favCount: Record<string, number> = {};
      (favs || []).forEach(f => {
        favCount[f.album_id] = (favCount[f.album_id] || 0) + 1;
      });

      const combined = rows.map(a => {
        const r = ratingsByAlbum[a.id] || [];
        const avg = r.length > 0 ? Number((r.reduce((s, x) => s + x, 0) / r.length).toFixed(1)) : "—";
        const userRatingObj = userRatings.find(ur => ur.album_id === a.id);
        const isFav = userFavs.some(f => f.album_id === a.id);

        return {
          ...a,
          artist_name: a.artists?.name || "Nieznany artysta",
          avg_rating: avg,
          votes: r.length,
          favorites_count: favCount[a.id] || 0,
          is_favorite: isFav,
          user_rating: userRatingObj ? Number(userRatingObj.rating) : null,
        };
      });

      setAlbums(combined);
      updateURL();
    } catch (e) {
      console.error("fetchAlbums", e);
    }
  }

  async function fetchTop10Albums() {
    try {
      // Najpierw pobierz wszystkie oceny i policz średnie
      const { data: allRatings } = await supabase
        .from("ratings")
        .select("album_id, rating");

      if (!allRatings) return setTop10Albums([]);

      // Oblicz średnie oceny dla każdego albumu
      const ratingsByAlbum: Record<string, number[]> = {};
      allRatings.forEach(r => {
        ratingsByAlbum[r.album_id] = ratingsByAlbum[r.album_id] || [];
        ratingsByAlbum[r.album_id].push(Number(r.rating));
      });

      // Pobierz albumy które mają oceny
      const albumIdsWithRatings = Object.keys(ratingsByAlbum);
      
      if (albumIdsWithRatings.length === 0) return setTop10Albums([]);

      const { data: albumsRaw } = await supabase
        .from("albums")
        .select(`id, title, cover_url, artist_id, artists(name), year`)
        .in("id", albumIdsWithRatings);

      if (!albumsRaw) return setTop10Albums([]);

      // Pobierz ulubione
      const { data: favs } = await supabase
        .from("favorites")
        .select("album_id");

      const favCount: Record<string, number> = {};
      (favs || []).forEach(f => {
        favCount[f.album_id] = (favCount[f.album_id] || 0) + 1;
      });

      // Pobierz oceny użytkownika jeśli jest zalogowany
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      let userRatings: any[] = [];
      let userFavs: any[] = [];

      if (user) {
        const [{ data: ur }, { data: uf }] = await Promise.all([
          supabase.from("ratings").select("album_id, rating").eq("user_id", user.id).in("album_id", albumIdsWithRatings),
          supabase.from("favorites").select("album_id").eq("user_id", user.id).in("album_id", albumIdsWithRatings),
        ]);

        userRatings = ur || [];
        userFavs = uf || [];
      }

      const merged = albumsRaw.map(a => {
        const r = ratingsByAlbum[a.id] || [];
        const avg = r.length ? Number((r.reduce((s, x) => s + x, 0) / r.length).toFixed(1)) : 0;
        const userRatingObj = userRatings.find(ur => ur.album_id === a.id);
        const isFav = userFavs.some(f => f.album_id === a.id);

        return {
          ...a,
          artist_name: a.artists?.name || "Nieznany artysta",
          avg_rating: avg,
          votes: r.length,
          favorites_count: favCount[a.id] || 0,
          is_favorite: isFav,
          user_rating: userRatingObj ? Number(userRatingObj.rating) : null,
        };
      });

      // Sortuj po średniej ocenie, liczbie głosów, ulubionych
      const sorted = merged.sort((a, b) => {
        // Najpierw po średniej ocenie
        if (b.avg_rating !== a.avg_rating) {
          return b.avg_rating - a.avg_rating;
        }
        // Potem po liczbie głosów
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        // Potem po liczbie ulubionych
        if (b.favorites_count !== a.favorites_count) {
          return b.favorites_count - a.favorites_count;
        }
        // Na końcu po roku
        return b.year - a.year;
      });

      setTop10Albums(sorted.slice(0, 10));
    } catch (e) {
      console.error("fetchTop10Albums", e);
    }
  }

  const toggleFavorite = async (albumId: string | number, isFav: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("Musisz być zalogowany");

    try {
      if (isFav) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("album_id", albumId);
      } else {
        await supabase
          .from("favorites")
          .insert({ 
            user_id: user.id, 
            album_id: albumId 
          });
      }

      fetchAlbums();
      fetchTop10Albums();
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const upsertRating = async (albumId: string | number, value: number) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("Musisz być zalogowany");

    try {
      // Najpierw spróbuj update, potem insert
      const { error: updateError } = await supabase
        .from("ratings")
        .update({ rating: value })
        .eq("user_id", user.id)
        .eq("album_id", albumId);

      if (updateError) {
        // Jeśli update nie zadziałał, spróbuj insert
        const { error: insertError } = await supabase
          .from("ratings")
          .insert({ 
            user_id: user.id, 
            album_id: albumId, 
            rating: value 
          });

        if (insertError) {
          console.error("Error inserting rating:", insertError);
          return;
        }
      }

      fetchAlbums();
      fetchTop10Albums();
    } catch (error) {
      console.error("Error upserting rating:", error);
    }
  };

  const goNext = () => {
    const max = Math.max(0, top10.length - visibleCount);
    setSlideIndex(s => (s >= max ? 0 : s + 1));
  };

  const goPrev = () => {
    const max = Math.max(0, top10.length - visibleCount);
    setSlideIndex(s => (s <= 0 ? max : s - 1));
  };

  const goToDot = (i: number) => {
    const max = Math.max(0, top10.length - visibleCount);
    setSlideIndex(Math.min(Math.max(0, i), max));
  };

  const buttonSize = Math.min(40, Math.floor((CARD_WIDTH - 24) / 10));

  const buttonStyle = {
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
    borderRadius: "9999px",
  } as const;

  const overlayVariants = {
    hidden: { opacity: 0, y: 6, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  // Funkcje do zarządzania hoverem
  const handleMouseEnter = (albumId: string | number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredRatingAlbum(albumId);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredRatingAlbum(null);
    }, 150);
  };

  const handleRatingClick = (albumId: string | number, value: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    upsertRating(albumId, value);
    setHoveredRatingAlbum(null);
  };

  return (
    <main className="px-6 py-10 min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto">

        {/* TOP 10 SLIDER */}
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">🔥 Top 10 albumów</h2>

        <div
          ref={containerRef}
          className="relative overflow-hidden pb-8"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="flex gap-6"
            style={{
              transform: `translateX(${calcTranslate()}px)`,
              transition: `transform ${TRANSITION_MS}ms ease`,
            }}
          >
            {top10.map((album, i) => (
              <div
                key={album.id}
                className="w-[240px] min-w-[240px] bg-[#171b20] rounded-xl border border-gray-700 shadow relative overflow-visible"
              >
                <div className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded text-xs z-30 font-bold">
                  #{i + 1}
                </div>

                {/* ------ SLIDER COVER ------ */}
                <div
                  className="relative h-48 w-full"
                  onMouseEnter={() => handleMouseEnter(album.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* OKŁADKA */}
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="h-full w-full object-cover rounded-t-xl"
                  />

                  {/* OVERLAY NA OKŁADCE */}
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-t-xl"
                    style={{
                      opacity: hoveredRatingAlbum === album.id ? 1 : 0,
                      transition: "opacity 150ms ease",
                      pointerEvents: hoveredRatingAlbum === album.id ? "auto" : "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-t-xl pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4), rgba(0,0,0,0.6))",
                      }}
                    />

                    <motion.div
                      className="relative z-10 w-full px-3"
                      initial="hidden"
                      animate={hoveredRatingAlbum === album.id ? "visible" : "hidden"}
                      variants={overlayVariants}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div className="grid grid-cols-10 gap-[2px] w-full">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const value = idx + 1;
                          const active = album.user_rating === value;

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRatingClick(album.id, value);
                              }}
                              style={buttonStyle}
                              className={`aspect-square rounded-full flex items-center justify-center text-[10px] font-bold transition 
                                ${
                                  active
                                    ? "bg-yellow-400 text-black scale-110"
                                    : "bg-gray-700 text-white hover:bg-yellow-300 hover:text-black hover:scale-110"
                                }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* ------ PANEL ALBUMU ------ */}
                <div className="p-3">
                  <p className="font-semibold text-sm text-white line-clamp-2">{album.title}</p>
                  <p className="text-xs text-gray-400">{album.artist_name}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-400">
                      ⭐ {album.avg_rating ?? "—"}
                      <span className="text-xs text-gray-300">({album.votes} głosów)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(album.id, album.is_favorite);
                        }}
                        className="text-lg hover:scale-105 transition"
                      >
                        {album.is_favorite ? "❤️" : "🤍"}
                      </button>

                      <span className="text-xs text-gray-300">{album.favorites_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Slider arrows */}
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full z-40"
          >
            ❮
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full z-40"
          >
            ❯
          </button>

          {/* Slider dots */}
          <div className="absolute bottom-2 w-full flex justify-center gap-2">
            {Array.from({
              length: Math.max(1, Math.max(0, top10.length - visibleCount + 1)),
            }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToDot(idx)}
                className={`w-3 h-3 rounded-full transition ${
                  idx === slideIndex ? "bg-yellow-400 scale-110" : "bg-gray-500"
                }`}
              />
            ))}
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-10 shadow-lg mt-14">
          <div className="flex flex-wrap gap-3 mb-4">

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔎 Szukaj albumu..."
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] flex-1"
            />

            <select
              value={artistFilter}
              onChange={e => setArtistFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-[#111418]"
            >
              <option value="">🎤 Wszyscy artyści</option>
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <select
              value={ratingMin === "" ? "" : String(ratingMin)}
              onChange={e => {
                const v = e.target.value;
                setRatingMin(v === "" ? "" : Number(v));
              }}
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-[#111418]"
            >
              <option value="">⭐ Minimalna ocena</option>
              {[...Array(10)].map((_, i) => (
                <option key={i} value={i + 1}>{i + 1}/10</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-[#111418]"
            >
              <option value="title">🔠 Tytuł</option>
              <option value="year">📅 Rok</option>
              <option value="rating">⭐ Ocena</option>
              <option value="popularity">🔥 Popularność</option>
            </select>

            <button
              onClick={() => {
                setSearch("");
                setArtistFilter("");
                setGenreFilter("");
                setSortBy("title");
                setRatingMin("");
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-[#252b33]"
              type="button"
            >
              ✖ Wyczyść
            </button>
          </div>
        </div>

        {/* GRID */}
        {albums.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {albums.map(album => (
              <div
                key={album.id}
                className="relative bg-[#171b20] rounded-xl overflow-visible shadow-md"
              >
                {/* COVER */}
                <div
                  className="relative h-52 w-full"
                  onMouseEnter={() => handleMouseEnter(album.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="h-full w-full object-cover rounded-t-xl"
                  />

                  {/* OVERLAY */}
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-t-xl"
                    style={{
                      opacity: hoveredRatingAlbum === album.id ? 1 : 0,
                      transition: "opacity 150ms ease",
                      pointerEvents: hoveredRatingAlbum === album.id ? "auto" : "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-t-xl pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4), rgba(0,0,0,0.6))",
                      }}
                    />

                    <motion.div
                      className="relative z-10 w-full px-3"
                      initial="hidden"
                      animate={hoveredRatingAlbum === album.id ? "visible" : "hidden"}
                      variants={overlayVariants}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div className="grid grid-cols-10 gap-[2px] w-full">
                        {Array.from({ length: 10 }).map((_, i) => {
                          const value = i + 1;
                          const active = album.user_rating === value;

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRatingClick(album.id, value);
                              }}
                              style={buttonStyle}
                              className={`aspect-square rounded-full flex items-center justify-center text-[10px] font-bold transition 
                                ${
                                  active
                                    ? "bg-yellow-400 text-black scale-110"
                                    : "bg-gray-700 text-white hover:bg-yellow-300 hover:text-black hover:scale-110"
                                }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* PANEL */}
                <div
                  className="p-4 text-center bg-white/10 backdrop-blur-md cursor-pointer rounded-b-xl"
                  onClick={() => router.push(`/album/${album.id}`)}
                >
                  <h3 className="font-semibold text-sm text-white line-clamp-2 mb-1">
                    {album.title}
                  </h3>

                  <p className="text-xs text-gray-400 mb-2">{album.artist_name}</p>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-yellow-500">
                      ⭐ {album.avg_rating ?? "—"}
                      <span className="text-xs text-gray-300">({album.votes} głosów)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(album.id, album.is_favorite);
                        }}
                        className="text-lg hover:scale-105 transition"
                      >
                        {album.is_favorite ? "❤️" : "🤍"}
                      </button>

                      <span className="text-xs text-gray-300">{album.favorites_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center text-gray-500">Brak albumów</div>
        )}

        {/* PAGINATION */}
        {total && total > limit && (
          <div className="mt-10 flex justify-center gap-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-2 border rounded-md"
              type="button"
            >
              ← Poprzednia
            </button>

            <span>Strona {page}</span>

            <button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-2 border rounded-md"
              type="button"
            >
              Następna →
            </button>
          </div>
        )}

      </div>
    </main>
  );
}