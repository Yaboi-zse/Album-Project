// pages/index.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../src/lib/supabaseClient";
import { motion } from "framer-motion";
import { useFilters } from '../src/hooks/useFilters';

function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// neon palette & helpers
const NEON = {
  blue: "#00eaff",
  magenta: "#ff2dff",
  purple: "#8a2be2",
  cyan: "#00ffd5",
};

const RATING_COLORS: Record<number, string> = {
  1: "#00bcd4",
  2: "#29b6f6",
  3: "#42a5f5",
  4: "#5c6bc0",
  5: "#7e57c2",
  6: "#ab47bc",
  7: "#ec407a",
  8: "#ff7043",
  9: "#ffa726",
  10: "#ffca28",
};

const neonGlowStyle = (color: string) => ({
  boxShadow: `0 8px 40px ${color}33, 0 0 18px ${color}66, inset 0 1px 0 ${color}22`,
});

function GenreTags({
  genre,
  collapseSignal,
}: {
  genre?: string | null;
  collapseSignal: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (collapseSignal) setExpanded(false);
  }, [collapseSignal]);

  const raw = (genre ?? "").trim();
  const list = raw.length
    ? raw.split(",").map(g => g.trim()).filter(Boolean)
    : [];

  if (list.length === 0) return null;

  const visible = expanded ? list : list.slice(0, 2);
  const hiddenCount = Math.max(0, list.length - visible.length);

  return (
    <div
      className="flex flex-wrap justify-center gap-2 mb-2 transition-all duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((g) => (
        <span
          key={g}
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(0,234,255,0.08)",
            border: "1px solid rgba(0,234,255,0.15)",
            color: "#c6efff",
            whiteSpace: "nowrap",
          }}
        >
          {g}
        </span>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{
            background: expanded
              ? "rgba(255,0,255,0.1)"
              : "rgba(255,255,255,0.05)",
            border: expanded
              ? "1px solid rgba(255,0,255,0.25)"
              : "1px solid rgba(255,255,255,0.12)",
            color: "#e4f6ff",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 180ms ease",
          }}
        >
          {expanded ? "−" : `+${hiddenCount}`}
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  // UŻYJ HOOKA useFilters ZAMIAST LOCAL STATE
  const {
    search,
    genreFilter,
    yearFrom,
    yearTo,
    ratingMin,
    sortBy,
    page,
    setPage
  } = useFilters();

  const debouncedSearch = useDebounced(search, 400);

  // data
  const [albums, setAlbums] = useState<any[]>([]);
  const [top10Albums, setTop10Albums] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(0);
  const [artists, setArtists] = useState<any[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const [artistFilter, setArtistFilter] = useState(""); // tylko ten pozostaje lokalny
  const limit = 12;
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

  // rating hover state
  const [hoveredRatingAlbum, setHoveredRatingAlbum] = useState<string | number | null>(null);
  const [hoveredRatingValue, setHoveredRatingValue] = useState<number | null>(null);

  const top10 = top10Albums || [];
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    function update() {
      const refWidth = containerRef.current?.offsetWidth;
      const effectiveWidth = refWidth && refWidth > 0 ? refWidth : window.innerWidth;

      let v = 4;
      const w = window.innerWidth;

      if (w < 640) v = 1;
      else if (w < 900) v = 2;
      else if (w < 1200) v = 3;
      else if (w < 1600) v = 4;
      else v = 5;

      setVisibleCount(v);
      setContainerWidth(effectiveWidth);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
useEffect(() => {
  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.background = "#03060a";
      document.body.style.background = "#03060a";
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.background = "#ffffff";
      document.body.style.background = "#ffffff";
    }
  };

  // Funkcja do sprawdzania i aplikowania motywu
  const checkAndApplyTheme = () => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = storedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(currentTheme);
  };

  // Nasłuchuj custom event od Headera
  const handleThemeChange = (event: CustomEvent) => {
    applyTheme(event.detail);
  };

  // Sprawdź motyw przy ładowaniu
  checkAndApplyTheme();

  // Dodaj event listener
  window.addEventListener('themeChange', handleThemeChange as EventListener);

  return () => {
    window.removeEventListener('themeChange', handleThemeChange as EventListener);
  };
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
    fetchGenres();
    fetchAlbums();
    fetchTop10Albums();
    fetchNewReleases().then(setNewReleases);
    fetchRecommendations().then(setRecommendations);
  }, []);
  // fetch albums gdy zmienią się filtry
  useEffect(() => {
    fetchAlbums();
  }, [
    page, 
    artistFilter, 
    genreFilter, 
    yearFrom, 
    yearTo, 
    ratingMin, 
    debouncedSearch, 
    sortBy
  ]);

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

    void ch1.subscribe();
    void ch2.subscribe();

    return () => {
      void supabase.removeChannel(ch1);
      void supabase.removeChannel(ch2);
    };
  }, []);

  // USUŃ updateURL - teraz to robi useFilters

  async function fetchArtists() {
    const { data } = await supabase.from("artists").select("id, name").order("name");
    setArtists(data || []);
  }

  async function fetchGenres() {
    const { data } = await supabase
      .from("albums")
      .select("genre")
      .not("genre", "is", null);

    if (!data) return setGenres([]);

    const uniq = Array.from(
      new Set(
        data
          .flatMap(a =>
            (a.genre || "")
              .split(",")
              .map((g: string) => g.trim())
              .filter(Boolean)
          )
      )
    ).sort((a, b) => a.localeCompare(b));

    setGenres(uniq);
  }

  async function fetchAlbums() {

    try {
      try {
    console.log("🔄 fetchAlbums called with:", {
      search,
      genreFilter, 
      yearFrom,
      yearTo,
      ratingMin,
      page,
      debouncedSearch
    });
  } catch {}
      const p_offset = (page - 1) * limit;

      // 1) total count
      const { count: totalCount } = await supabase
        .from("albums")
        .select("*", { count: "exact", head: true });
      setTotal(totalCount ?? 0);

      // 2) base query
      let query = supabase
        .from("albums")
        .select(`id, title, year, genre, cover_url, artist_id, artists(name)`)
        .range(p_offset, p_offset + limit - 1);

      // UŻYJ PARAMETRÓW Z useFilters
      // search filter
      if (debouncedSearch) query = query.ilike("title", `%${debouncedSearch}%`);

      // genre filter
      if (genreFilter) {
        const genreList = genreFilter.split(',').map(g => g.trim()).filter(Boolean);
        if (genreList.length > 0) {
          const orConditions = genreList.map(genre => `genre.ilike.%${genre}%`).join(',');
          query = query.or(orConditions);
        }
      }

      // year filters
      if (yearFrom) query = query.gte("year", parseInt(yearFrom));
      if (yearTo) query = query.lte("year", parseInt(yearTo));

      // artist filter
      if (artistFilter) query = query.eq("artist_id", artistFilter);

      // sorting
      if (sortBy === "title") query = query.order("title", { ascending: true });
      else if (sortBy === "year") query = query.order("year", { ascending: false });


      const { data: rows } = await query;

      if (!rows || rows.length === 0) {
        setAlbums([]);
        return;
      }
      const ids = rows.map((r) => r.id);

      // 3) ratings / favorites / user data
      const [{ data: ratings }, { data: favs }, { data: userData }] = await Promise.all([
        supabase.from("ratings").select("album_id, rating").in("album_id", ids),
        supabase.from("favorites").select("album_id").in("album_id", ids),
        supabase.auth.getUser(),
      ]);

      const currentUser = userData?.user ?? null;

      let userRatings: any[] = [];
      let userFavs: any[] = [];

      if (currentUser) {
        const [{ data: ur }, { data: uf }] = await Promise.all([
          supabase.from("ratings").select("album_id, rating").eq("user_id", currentUser.id).in("album_id", ids),
          supabase.from("favorites").select("album_id").eq("user_id", currentUser.id).in("album_id", ids),
        ]);
        userRatings = ur || [];
        userFavs = uf || [];
      }

      // group ratings & favs
      const ratingsByAlbum: Record<string, number[]> = {};
      (ratings || []).forEach((r) => {
        if (!ratingsByAlbum[r.album_id]) ratingsByAlbum[r.album_id] = [];
        ratingsByAlbum[r.album_id].push(Number(r.rating));
      });

      const favCount: Record<string, number> = {};
      (favs || []).forEach((f) => {
        favCount[f.album_id] = (favCount[f.album_id] || 0) + 1;
      });

      // 4) merge
      let combined = rows.map((a: any) => {
        const r = ratingsByAlbum[a.id] || [];
        const avg = r.length > 0 ? Number((r.reduce((s, x) => s + x, 0) / r.length).toFixed(1)) : "—";
        const userRatingObj = userRatings.find((ur) => ur.album_id === a.id);
        const isFav = userFavs.some((f) => f.album_id === a.id);

        // normalize artist_name
        const artist_name = Array.isArray(a.artists) 
          ? a.artists[0]?.name ?? null 
          : a.artists?.name ?? "Nieznany artysta";

        return {
          ...a,
          artist_name,
          genre: a.genre ?? null,
          is_single: a.genre == null,
          avg_rating: avg,
          votes: r.length,
          favorites_count: favCount[a.id] || 0,
          is_favorite: isFav,
          user_rating: userRatingObj ? Number(userRatingObj.rating) : null,
        };
      });

      // 5) APPLY RATING FILTER CLIENT-SIDE
      if (ratingMin !== "") {
        combined = combined.filter(album => {
          if (album.avg_rating === "—") return false;
          return Number(album.avg_rating) >= Number(ratingMin);
        });
      }

      // 6) APPLY GENRE FILTER CLIENT-SIDE
      if (genreFilter) {
        const genreList = genreFilter.split(',').map(g => g.trim()).filter(Boolean);
        if (genreList.length > 0) {
          combined = combined.filter(album => {
            if (!album.genre) return false;
            const albumGenres = album.genre.split(',').map((g: string) => g.trim());
            return genreList.some(selectedGenre => 
              albumGenres.some((albumGenre: string) => 
                albumGenre.toLowerCase().includes(selectedGenre.toLowerCase())
              )
            );
          });
        }
      }

      setAlbums(combined);
    } catch (e) {
      console.error("fetchAlbums:", e);
      setAlbums([]);
    }
  }
async function fetchNewReleases() {
  const { data } = await supabase
    .from("albums")
    .select(`id, title, cover_url, artist_id, artists(name), created_at`)
    .order("created_at", { ascending: false })
    .limit(8);

  return data || [];
}
async function fetchRecommendations() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return [];

  // 1. Pobierz twoje oceny
  const { data: myRatings } = await supabase
    .from("ratings")
    .select("album_id, rating")
    .eq("user_id", user.id)
    .gte("rating", 7);

  if (!myRatings || myRatings.length === 0) return [];

  const ratedIds = myRatings.map(r => r.album_id);

  // 2. Pobierz albumy które lubisz (żeby wyciągnąć gatunki)
  const { data: likedAlbums } = await supabase
    .from("albums")
    .select("genre")
    .in("id", ratedIds);

  const genres = Array.from(
    new Set(
      likedAlbums
        .flatMap(a =>
          (a.genre || "")
            .split(",")
            .map(g => g.trim())
            .filter(Boolean)
        )
    )
  );

  if (genres.length === 0) return [];

  // 3. Pobierz albumy w tych gatunkach, których jeszcze nie oceniałeś
  let orConditions = genres
    .map(g => `genre.ilike.%${g}%`)
    .join(",");

  const { data: candidates } = await supabase
    .from("albums")
    .select(`id, title, cover_url, artist_id, artists(name), genre`)
    .or(orConditions)
    .not("id", "in", `(${ratedIds.join(",")})`)
    .limit(10);

  return candidates || [];
}

async function fetchTop10Albums() {
  try {
    // Najpierw pobierz wszystkie oceny i oblicz średnie
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("album_id, rating");

    if (!ratingsData) {
      setTop10Albums([]);
      return;
    }

    // Oblicz średnie oceny dla każdego albumu
    const albumRatings: Record<string, { sum: number; count: number }> = {};
    
    ratingsData.forEach(rating => {
      if (!albumRatings[rating.album_id]) {
        albumRatings[rating.album_id] = { sum: 0, count: 0 };
      }
      albumRatings[rating.album_id].sum += rating.rating;
      albumRatings[rating.album_id].count += 1;
    });

    // Oblicz średnie i posortuj albumy według średniej oceny
    const albumsWithAvgRating = Object.entries(albumRatings)
      .map(([album_id, data]) => ({
        album_id,
        avg_rating: Number((data.sum / data.count).toFixed(1)),
        votes: data.count
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 10);

    // Jeśli nie ma albumów z ocenami, zakończ
    if (albumsWithAvgRating.length === 0) {
      setTop10Albums([]);
      return;
    }

    // Pobierz szczegóły albumów z top 10
    const albumIds = albumsWithAvgRating.map(item => item.album_id);
    
    const { data: albumsData } = await supabase
      .from("albums")
      .select(`
        id,
        title,
        year,
        genre,
        cover_url,
        artist_id,
        artists(name)
      `)
      .in("id", albumIds);

    if (!albumsData) {
      setTop10Albums([]);
      return;
    }

    // Połącz dane albumów ze średnimi ocenami
    const albumsWithDetails = albumsData.map(album => {
      const ratingInfo = albumsWithAvgRating.find(item => item.album_id === album.id);
      return {
        ...album,
        artist_name: Array.isArray(album.artists) 
          ? album.artists[0]?.name ?? "Nieznany artysta"
          : album.artists?.name ?? "Nieznany artysta",
        avg_rating: ratingInfo?.avg_rating ?? 0,
        votes: ratingInfo?.votes ?? 0,
      };
    });

    // Posortuj według średniej oceny (ponownie, na wypadek zmiany kolejności)
    const sortedAlbums = albumsWithDetails.sort((a, b) => b.avg_rating - a.avg_rating);

    // Pobierz dane użytkownika dla top 10 albumów
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;

    let userRatings: any[] = [];
    let userFavs: any[] = [];

    if (currentUser) {
      const [{ data: ur }, { data: uf }] = await Promise.all([
        supabase.from("ratings").select("album_id, rating").eq("user_id", currentUser.id).in("album_id", albumIds),
        supabase.from("favorites").select("album_id").eq("user_id", currentUser.id).in("album_id", albumIds),
      ]);
      userRatings = ur || [];
      userFavs = uf || [];
    }

    // Dodaj dane użytkownika do top 10
    const top10WithUserData = sortedAlbums.map(album => {
      const userRatingObj = userRatings.find(ur => ur.album_id === album.id);
      const isFav = userFavs.some(f => f.album_id === album.id);

      return {
        ...album,
        is_favorite: isFav,
        user_rating: userRatingObj ? Number(userRatingObj.rating) : null,
        favorites_count: userFavs.filter(f => f.album_id === album.id).length,
      };
    });

    setTop10Albums(top10WithUserData);
    
    // Debug: sprawdź dane
    console.log("Top 10 albums data:", top10WithUserData);
  } catch (error) {
    console.error("Error fetching top 10 albums:", error);
    setTop10Albums([]);
  }
}
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

  // hover helpers
  const handleMouseEnter = (albumId: string | number) => {
    setHoveredRatingAlbum(albumId);
    setHoveredRatingValue(null);
  };

  const handleMouseLeave = () => {
    setHoveredRatingAlbum(null);
    setHoveredRatingValue(null);
  };

  const handleRatingHover = (value: number | null) => {
    setHoveredRatingValue(value);
  };
const toggleFavorite = async (albumId: string | number, isFav: boolean) => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return alert("Musisz być zalogowany");

  try {
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("album_id", albumId);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, album_id: albumId });
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
    const { error: updateError } = await supabase
      .from("ratings")
      .update({ rating: value })
      .eq("user_id", user.id)
      .eq("album_id", albumId);

    if (updateError) {
      const { error: insertError } = await supabase
        .from("ratings")
        .insert({ user_id: user.id, album_id: albumId, rating: value });

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

  const handleRatingClick = (albumId: string | number, value: number) => {
    upsertRating(albumId, value);
  };

  return (
    <main
className={`pt-24 pb-10 min-h-screen transition-colors duration-300
  bg-white text-black
  dark:bg-[#03060a] dark:text-[#e6eef8]
  dark:bg-[radial-gradient(1200px_600px_at_10%_10%,rgba(138,43,226,0.06),transparent),radial-gradient(1000px_500px_at_90%_90%,rgba(0,234,255,0.04),transparent),#03060a]
`}

    >
      <div className="max-w-7xl mx-auto px-4">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* TOP 10 SLIDER */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-3" style={{ color: "#f7f9ff" }}>
            🔥 Top 10 albumów
          </h2>

          <div
            ref={containerRef}
            className="relative overflow-hidden pb-8"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div
              className="flex gap-6 transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(${calcTranslate()}px)`,
              }}
            >
              {top10.map((album, i) => {
                const isHovered = hoveredRatingAlbum === album.id;
                return (
                  <motion.div
                    key={album.id}
                    className="w-60 min-w-60 rounded-xl border border-transparent relative overflow-visible cursor-pointer shrink-0"
                    initial={{ scale: 1 }}
                    animate={isHovered ? { scale: 1.06 } : { scale: 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: "linear-gradient(180deg, rgba(8,10,15,0.8), rgba(8,10,15,0.6))",
                      border: `1px solid rgba(255,255,255,0.03)`,
                      ...(isHovered ? neonGlowStyle(NEON.blue) : { boxShadow: "0 6px 18px rgba(0,0,0,0.4)" }),
                    }}
                    onClick={() => router.push(`/album/${album.id}`)}
                  >
                    <div className="absolute top-2 left-2 bg-linear-to-r from-purple-500 to-cyan-400 text-black px-2 py-1 rounded text-xs z-40 font-bold">
                      #{i + 1}
                    </div>

                    {/* COVER + OVERLAY */}
                    <div
                      className="relative h-48 w-full rounded-xl overflow-hidden"
                      onMouseEnter={() => handleMouseEnter(album.id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <img
                        src={album.cover_url}
                        alt={album.title}
                        className="h-full w-full object-cover rounded-xl"
                        style={{
                          transform: isHovered ? "scale(1.04) translateY(-6px)" : "scale(1)",
                          transition: "transform 220ms ease",
                        }}
                      />

                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-t-xl"
                        style={{
                          opacity: isHovered ? 1 : 0,
                          transition: "opacity 80ms ease-out",
                          pointerEvents: isHovered ? "auto" : "none",
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            background: "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35))",
                            backdropFilter: "blur(6px)",
                          }}
                        />

                        <motion.div
                          className="relative z-10 w-full px-3 pointer-events-auto"
                          initial="hidden"
                          animate={isHovered ? "visible" : "hidden"}
                          variants={overlayVariants}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <div className="grid grid-cols-10 gap-1.5 w-full">
                            {Array.from({ length: 10 }).map((_, idx) => {
                              const value = idx + 1;
                              const active = album.user_rating === value;
                              const highlight =
                                hoveredRatingValue !== null &&
                                hoveredRatingAlbum === album.id &&
                                value <= hoveredRatingValue;

                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onMouseEnter={() => handleRatingHover(value)}
                                  onMouseLeave={() => handleRatingHover(null)}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRatingClick(album.id, value);
                                  }}
                                  style={{
                                    ...buttonStyle,
                                    position: "relative",
                                    background: active
                                      ? RATING_COLORS[value]
                                      : highlight
                                      ? RATING_COLORS[value] + "33"
                                      : "rgba(255,255,255,0.08)",
                                    border: active
                                      ? `2px solid ${RATING_COLORS[value]}`
                                      : highlight
                                      ? `2px solid ${RATING_COLORS[value]}88`
                                      : "1px solid rgba(255,255,255,0.2)",
                                    transform: active
                                      ? "scale(1.2)"
                                      : highlight
                                      ? "scale(1.1)"
                                      : "scale(1)",
                                    boxShadow: active
                                      ? `0 0 12px ${RATING_COLORS[value]}, 0 0 20px ${RATING_COLORS[value]}55`
                                      : highlight
                                      ? `0 0 10px ${RATING_COLORS[value]}44`
                                      : "none",
                                    transition:
                                      "transform 90ms ease, background 100ms ease, border 120ms ease, box-shadow 120ms ease",
                                  }}
                                  className="rating-circle aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </div>
                    </div>

                    {/* INFO PANEL */}
                    <div className="p-3">
                      <p className="font-semibold text-sm line-clamp-2" style={{ color: "#f8fbff" }}>
                        {album.title}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#9fb6d6" }}>
                        {album.artist_name}
                      </p>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-yellow-400">
                          <span style={{ filter: "drop-shadow(0 4px 8px rgba(255,200,0,0.08))" }}>⭐</span>
                          <span style={{ color: "#ffeaa7", fontWeight: 700 }}>
                            {album.avg_rating ?? "—"}
                          </span>
                          <span className="text-xs" style={{ color: "#9fb6d6" }}>
                            ({album.votes} głosów)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(album.id, album.is_favorite);
                            }}
                            className="text-lg"
                            style={{
                              transform: "translateZ(0)",
                              textShadow: album.is_favorite
                                ? `0 4px 20px ${NEON.magenta}66`
                                : undefined,
                            }}
                          >
                            {album.is_favorite ? "❤️" : "🤍"}
                          </button>

                          <span className="text-xs" style={{ color: "#9fb6d6" }}>
                            {album.favorites_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* arrows - pokazuj tylko jeśli jest więcej albumów niż visibleCount */}
            {top10.length > visibleCount && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full z-40 hover:scale-110 transition-transform"
                  style={{
                    background: "linear-gradient(90deg, rgba(255,0,255,0.06), rgba(0,234,255,0.04))",
                    border: "1px solid rgba(255,255,255,0.03)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                    color: "#dff9ff",
                  }}
                >
                  <span style={{ fontSize: 18 }}>❮</span>
                </button>

                <button
                  onClick={goNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full z-40 hover:scale-110 transition-transform"
                  style={{
                    background: "linear-gradient(90deg, rgba(0,234,255,0.04), rgba(255,0,255,0.04))",
                    border: "1px solid rgba(255,255,255,0.03)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                    color: "#dff9ff",
                  }}
                >
                  <span style={{ fontSize: 18 }}>❯</span>
                </button>
              </>
            )}

            {/* dots - pokazuj tylko jeśli jest więcej niż 1 slajd */}
            {top10.length > visibleCount && (
              <div className="absolute bottom-2 w-full flex justify-center gap-2">
                {Array.from({
                  length: Math.max(1, Math.max(0, top10.length - visibleCount + 1)),
                }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToDot(idx)}
                    className={`w-3 h-3 rounded-full transition ${idx === slideIndex ? "scale-110" : ""}`}
                    style={{
                      background: idx === slideIndex ? NEON.blue : "rgba(255,255,255,0.06)",
                      boxShadow:
                        idx === slideIndex ? `0 6px 18px ${NEON.blue}55` : undefined,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

{/* LAYOUT: LEWA LISTA + PRAWA PROPOZYCJE */}
<section className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-10">

  {/* LEWA LISTA – WSZYSTKIE ALBUMY */}
  <div className="lg:col-span-2">

    {albums.length > 0 ? (
      <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        
        {/* --- TWOJE KARTY ALBUMÓW (BEZ ZMIAN) --- */}
        {albums.map(album => {
          const isHovered = hoveredRatingAlbum === album.id;

          return (
            <div
              key={album.id}
              className="relative rounded-xl overflow-visible cursor-pointer"
              style={{
                background: "linear-gradient(180deg, rgba(10,12,18,0.85), rgba(8,10,14,0.7))",
                border: "1px solid rgba(255,255,255,0.02)",
                ...(isHovered
                  ? neonGlowStyle(NEON.magenta)
                  : { boxShadow: "0 8px 18px rgba(0,0,0,0.6)" }),
                transition: "box-shadow 160ms ease, transform 160ms ease",
                transform: isHovered ? "translateY(-6px)" : "translateY(0)",
              }}
              onClick={() => router.push(`/album/${album.id}`)}
              onMouseEnter={() => handleMouseEnter(album.id)}
              onMouseLeave={handleMouseLeave}
            >

              {/* COVER */}
              <div className="relative h-52 w-full rounded-xl overflow-hidden">
                <img
                  src={album.cover_url}
                  alt={album.title}
                  className="h-full w-full object-cover rounded-t-xl"
                />

                {/* RATING OVERLAY */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-t-xl"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 80ms ease-out",
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
                    className="relative z-10 w-full px-3 pointer-events-auto"
                    initial="hidden"
                    animate={isHovered ? "visible" : "hidden"}
                    variants={overlayVariants}
                    transition={{ duration: 0.16 }}
                  >
                    <div className="grid grid-cols-10 gap-1.5 w-full">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const value = idx + 1;
                        const active = album.user_rating === value;
                        const highlight =
                          hoveredRatingValue !== null &&
                          hoveredRatingAlbum === album.id &&
                          value <= hoveredRatingValue;

                        return (
                          <button
                            key={value}
                            type="button"
                            onMouseEnter={() => handleRatingHover(value)}
                            onMouseLeave={() => handleRatingHover(null)}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRatingClick(album.id, value);
                            }}
                            style={{
                              ...buttonStyle,
                              position: "relative",
                              background: active
                                ? RATING_COLORS[value]
                                : highlight
                                ? RATING_COLORS[value] + "33"
                                : "rgba(255,255,255,0.08)",
                              border: active
                                ? `2px solid ${RATING_COLORS[value]}`
                                : highlight
                                ? `2px solid ${RATING_COLORS[value]}88`
                                : "1px solid rgba(255,255,255,0.2)",
                              transform: active
                                ? "scale(1.2)"
                                : highlight
                                ? "scale(1.1)"
                                : "scale(1)",
                              boxShadow: active
                                ? `0 0 12px ${RATING_COLORS[value]}, 0 0 20px ${RATING_COLORS[value]}55`
                                : highlight
                                ? `0 0 10px ${RATING_COLORS[value]}44`
                                : "none",
                              transition:
                                "transform 90ms ease, background 100ms ease, border 120ms ease, box-shadow 120ms ease",
                            }}
                            className="rating-circle aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* INFO PANEL */}
              <div className="p-4 text-center rounded-b-xl h-[165px] flex flex-col justify-between">

                <h3 className="font-semibold text-sm line-clamp-2 mb-1" style={{ color: "#f8fbff" }}>
                  {album.title}
                </h3>

                <p className="text-xs text-[#9fb6d6] mb-2">{album.artist_name}</p>

                {album.genre && (
                  <GenreTags genre={album.genre} collapseSignal={!isHovered} />
                )}

                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <span style={{ color: "#ffeaa7", fontWeight: 700 }}>
                      {album.avg_rating ?? "—"}
                    </span>
                    <span className="text-xs" style={{ color: "#9fb6d6" }}>
                      ({album.votes} głosów)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(album.id, album.is_favorite);
                      }}
                      className="text-lg"
                      style={{
                        textShadow: album.is_favorite
                          ? `0 4px 20px ${NEON.magenta}66`
                          : undefined,
                      }}
                    >
                      {album.is_favorite ? "❤️" : "🤍"}
                    </button>

                    <span className="text-xs" style={{ color: "#9fb6d6" }}>
                      {album.favorites_count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* --- KONIEC TWOICH KART --- */}
      </div>
    ) : (
      <div className="py-24 text-center text-gray-400">Brak albumów</div>
    )}

  </div>




{/* PRAWA KOLUMNA – PROPOZYCJE */}
<aside className="lg:col-span-1 space-y-8 sticky top-28 h-fit">

  {/* NOWE WYDANIA – sortowane po created_at */}
  <div className="p-4 rounded-xl border border-white/10 bg-white/5 dark:bg-black/20">
    <h3 className="text-lg font-bold mb-4">🆕 Nowe wydania</h3>

    {newReleases.length === 0 && <p className="text-gray-400 text-sm">Brak nowych albumów</p>}

    {newReleases.slice(0, 5).map(a => (
      <div
        key={a.id}
        onClick={() => router.push(`/album/${a.id}`)}
        className="flex gap-3 items-center mb-3 cursor-pointer hover:opacity-80 transition"
      >
        <img src={a.cover_url} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-semibold">{a.title}</p>
          <p className="text-xs text-gray-400">{a.artists?.name}</p>
        </div>
      </div>
    ))}
  </div>

  {/* REKOMENDACJE – Na podstawie Twoich ocen */}
  <div className="p-4 rounded-xl border border-white/10 bg-white/5 dark:bg-black/20">
    <h3 className="text-lg font-bold mb-4">✨ Na podstawie Twoich ocen</h3>

    {!recommendations.length && (
      <p className="text-gray-400 text-sm">Oceń kilka albumów aby dostać rekomendacje 🎵</p>
    )}

    {recommendations.slice(0, 5).map(a => (
      <div
        key={a.id}
        onClick={() => router.push(`/album/${a.id}`)}
        className="flex gap-3 items-center mb-3 cursor-pointer hover:opacity-80 transition"
      >
        <img src={a.cover_url} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-semibold">{a.title}</p>
          <p className="text-xs text-gray-400">{a.artists?.name}</p>
          <p className="text-[10px] text-purple-300">{a.genre}</p>
        </div>
      </div>
    ))}
  </div>

  {/* POPULARNE DZISIAJ */}
  <div className="p-4 rounded-xl border border-white/10 bg-white/5 dark:bg-black/20">
    <h3 className="text-lg font-bold mb-4">🔥 Popularne dziś</h3>

    {top10Albums.slice(0, 5).map(a => (
      <div
        key={a.id}
        onClick={() => router.push(`/album/${a.id}`)}
        className="flex gap-3 items-center mb-3 cursor-pointer hover:opacity-80 transition"
      >
        <img src={a.cover_url} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-semibold">{a.title}</p>
          <p className="text-xs text-gray-400">{a.artist_name}</p>
        </div>
      </div>
    ))}
  </div>

</aside>

</section>

        {/* PAGINATION */}
        {total && total > limit && (
          <div className="mt-10 flex justify-center gap-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-md"
              style={{
                background: "linear-gradient(90deg, rgba(255,0,255,0.02), rgba(0,234,255,0.02))",
                border: "1px solid rgba(255,255,255,0.03)",
                color: "#dff6ff",
              }}
            >
              ← Poprzednia
            </button>

            <span style={{ color: "#cfeaff", alignSelf: "center" }}>
              Strona {page}
            </span>

            <button
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-2 rounded-md"
              style={{
                background: "linear-gradient(90deg, rgba(0,234,255,0.02), rgba(255,0,255,0.02))",
                border: "1px solid rgba(255,255,255,0.03)",
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