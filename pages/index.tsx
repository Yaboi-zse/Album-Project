import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../src/lib/supabaseClient'
import SpotifyImporter from '../src/components/SpotifyImporter'
import Header from '../src/components/Header'
import AlbumCard from "../src/components/AlbumCard";
import { motion } from "framer-motion";

function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export default function HomePage() {
  const router = useRouter()

  const [albums, setAlbums] = useState<any[]>([])
  const [total, setTotal] = useState<number | null>(0)
  const [artists, setArtists] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [artistFilter, setArtistFilter] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [ratingMin, setRatingMin] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState('title')
  const [page, setPage] = useState(1)
  const limit = 20

  const debouncedSearch = useDebounced(search, 400)

  useEffect(() => {
    fetchArtists()
  }, [])

  useEffect(() => {
    fetchAlbums()
    updateURL()
  }, [page, artistFilter, genreFilter, yearFrom, yearTo, ratingMin, debouncedSearch, sortBy])

  // 🔁 Realtime oceny
  useEffect(() => {
    const channel = supabase
      .channel('ratings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, fetchAlbums)

    void channel.subscribe() // ✅ ignonrujemy promise

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // 🔁 Realtime ulubione
  useEffect(() => {
    const channel = supabase
      .channel('favorites-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites' }, fetchAlbums)

    void channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])


  const updateURL = () => {
    const params: Record<string, string> = {}
    if (debouncedSearch) params.q = debouncedSearch
    if (artistFilter) params.artist = artistFilter
    if (genreFilter) params.genre = genreFilter
    if (yearFrom) params.yearFrom = yearFrom
    if (yearTo) params.yearTo = yearTo
    if (ratingMin !== '') params.rmin = String(ratingMin)
    if (sortBy !== 'title') params.sort = sortBy
    if (page > 1) params.page = String(page)
    router.replace({ pathname: '/', query: params }, undefined, { shallow: true })
  }

  async function fetchArtists() {
    const { data, error } = await supabase.from('artists').select('id, name').order('name')
    if (!error) setArtists(data || [])
  }

async function fetchAlbums() {
  try {
    const p_offset = (page - 1) * limit;
    let query = supabase
      .from('albums')
      .select(`id, title, year, cover_url, artist_id, artists(name)`)
      .range(p_offset, p_offset + limit - 1)
      .order(sortBy);

    if (artistFilter) query = query.eq('artist_id', artistFilter);
    if (genreFilter && genreFilter !== '__NO_GENRE__') query = query.eq('genre', genreFilter);
    if (debouncedSearch) query = query.ilike('title', `%${debouncedSearch}%`);

    const { data: rows, error } = await query;
    if (error) {
      console.error('Błąd pobierania albumów:', error);
      return;
    }

    const albumsRaw = (rows || []).map((a: any) => ({
      ...a,
      artist_name: a.artists?.name || 'Nieznany artysta',
    }));

    if (albumsRaw.length === 0) {
      setAlbums([]);
      return;
    }

    // pobierz wszystkie oceny
    const { data: allRatings } = await supabase
      .from('ratings')
      .select('album_id, rating')
      .in('album_id', albumsRaw.map((a) => a.id));

    // pobierz liczbę ulubień
    const { data: allFavs } = await supabase
      .from('favorites')
      .select('album_id')
      .in('album_id', albumsRaw.map((a) => a.id));

    const favoritesCount: Record<string, number> = {};
    (allFavs || []).forEach((f) => {
      favoritesCount[f.album_id] = (favoritesCount[f.album_id] || 0) + 1;
    });

    // zalogowany użytkownik
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    let userRatings: any[] = [];
    let favorites: any[] = [];

    if (user) {
      const { data: ur } = await supabase
        .from('ratings')
        .select('album_id, rating')
        .eq('user_id', user.id)
        .in('album_id', albumsRaw.map((a) => a.id));
      userRatings = ur || [];

      const { data: favs } = await supabase
        .from('favorites')
        .select('album_id')
        .eq('user_id', user.id)
        .in('album_id', albumsRaw.map((a) => a.id));
      favorites = favs || [];
    }

    const ratingsByAlbum: Record<string, number[]> = {};
    (allRatings || []).forEach((r: any) => {
      ratingsByAlbum[r.album_id] = ratingsByAlbum[r.album_id] || [];
      ratingsByAlbum[r.album_id].push(Number(r.rating));
    });

    const combined = albumsRaw.map((a) => {
      const r = ratingsByAlbum[a.id] || [];
      const avg = r.length > 0 ? (r.reduce((s, x) => s + Number(x), 0) / r.length).toFixed(1) : null;
      const userRatingObj = userRatings.find((ur) => ur.album_id === a.id);
      return {
        ...a,
        avg_rating: avg ?? '—',
        votes: r.length,
        is_favorite: favorites.some((f) => f.album_id === a.id),
        favorites_count: favoritesCount[a.id] || 0, // 🧡 licznik ulubień
        user_rating: userRatingObj ? Number(userRatingObj.rating) : null,
      };
    });

    setAlbums(combined);
  } catch (e) {
    console.error(e);
  }
}


  const handleRating = async (albumId: string, rating: number) => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return alert('Musisz być zalogowany')

    await supabase.from('ratings').upsert({ user_id: user.id, album_id: albumId, rating })
    fetchAlbums()
  }

  const toggleFavorite = async (albumId: string, isFav: boolean) => {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return alert('Musisz być zalogowany')

    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('album_id', albumId)
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, album_id: albumId })
    }
    fetchAlbums()
  }

return (
  <main className="px-6 py-10 min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-900 dark:text-gray-100 transition-all duration-500 ease-in-out">
    <div className="max-w-7xl mx-auto">
      {/* 🌆 Hero Section */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">
          🎵 Odkrywaj, oceniaj i kolekcjonuj albumy
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Znajdź swoje ulubione albumy, sprawdź średnie oceny i dodaj do ulubionych ❤️
        </p>
      </div>

      {/* 🔍 Panel filtrów */}
      <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-10 shadow-lg backdrop-blur-md transition-all duration-300">
        <div className="flex flex-wrap gap-3 flex-1 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 Szukaj albumu..."
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
          />

          <select
            value={artistFilter}
            onChange={(e) => setArtistFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">🎤 Wszyscy artyści</option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#111418] text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="title">🔠 Sortuj: Tytuł</option>
            <option value="year">📅 Sortuj: Rok</option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setArtistFilter("");
              setSortBy("title");
            }}
            className="text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-[#252b33] hover:bg-gray-200 dark:hover:bg-[#2f3640] transition"
          >
            ✖ Wyczyść
          </button>
        </div>
      </div>

      {/* 💿 Lista albumów */}
      {albums.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 overflow-visible">
          {albums.map((album, i) => (
<motion.div
  key={album.id}
  className="relative z-10 group hover:z-50 rounded-xl overflow-visible shadow-md transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02]"
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.03 }}
>
<Link
  href={`/album/${album.id}`}
  className="relative block group rounded-xl overflow-visible shadow-md bg-linear-to-br from-gray-100 via-gray-50 to-gray-200 dark:from-[#14181f] dark:via-[#1a1f25] dark:to-[#111418] transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02]"
>
  {/* 🖼️ Okładka */}
  <div className="relative overflow-hidden">
    {album.cover_url ? (
      <img
        src={album.cover_url}
        alt={album.title}
        className="w-full h-52 object-cover transition-transform duration-500 ease-out group-hover:scale-110 group-hover:brightness-[1.15]"
      />
    ) : (
      <div className="w-full h-52 bg-gray-200 dark:bg-[#2b3038] flex items-center justify-center text-gray-500 dark:text-gray-400">
        Brak okładki
      </div>
    )}

    {/* 🌈 Premium gradient overlay */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-[#1db954]/70 via-[#00b4d8]/50 to-[#7209b7]/60 dark:from-[#1db954]/40 dark:via-[#00b4d8]/30 dark:to-[#7209b7]/40 mix-blend-overlay blur-sm"></div>

{/* ⭐ Hover oceny */}
<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-linear-to-t from-black/80 to-transparent z-30">
  <p className="text-gray-200 text-sm mb-1">Oceń album</p>
  <div className="flex flex-wrap justify-center gap-1.5">
    {[...Array(10)].map((_, idx) => {
      const rating = idx + 1;
      const userRating = album.user_rating; // <- dodaj to w danych albumu
      const isActive = userRating && rating <= userRating;

      return (
        <button
          key={rating}
          title={
            userRating === rating
              ? `Twoja ocena: ${userRating}/10`
              : `Oceń na ${rating}/10`
          }
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const { data: userData } = await supabase.auth.getUser();
            const user = userData?.user;
            if (!user) {
              alert("Musisz być zalogowany, aby ocenić album.");
              return;
            }

            try {
              const { data: existing, error: checkError } = await supabase
                .from("ratings")
                .select("id")
                .eq("user_id", user.id)
                .eq("album_id", album.id)
                .maybeSingle();

              if (checkError) throw checkError;

              if (existing) {
                const { error: updateError } = await supabase
                  .from("ratings")
                  .update({ rating, created_at: new Date().toISOString() })
                  .eq("id", existing.id);
                if (updateError) throw updateError;
              } else {
                const { error: insertError } = await supabase.from("ratings").insert({
                  user_id: user.id,
                  album_id: album.id,
                  rating,
                  created_at: new Date().toISOString(),
                });
                if (insertError) throw insertError;
              }

              fetchAlbums(); // 🔄 odśwież dane po ocenie
            } catch (err) {
              console.error("Błąd przy zapisie oceny:", err);
              alert("Wystąpił błąd przy zapisywaniu oceny. Spróbuj ponownie.");
            }
          }}
          className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-150
            ${
              isActive
                ? "bg-yellow-400 text-black scale-110 shadow-yellow-500/40"
                : "bg-gray-200/80 dark:bg-[#2b3038]/80 text-gray-900 dark:text-gray-100 hover:bg-yellow-400 hover:text-black"
            }`}
        >
          {rating}
        </button>
      );
    })}
  </div>
</div>
</div>

  {/* 📄 Info o albumie */}
  <div className="p-4 flex flex-col justify-between text-center bg-white/60 dark:bg-[#181c22]/80 backdrop-blur-md">
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-1">
        {album.title}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {album.artist_name || "Nieznany artysta"}
      </p>
    </div>

<div className="mt-3 flex items-center justify-between">
  {/* ⭐ Średnia ocena */}
  <div className="text-sm text-yellow-500 flex items-center gap-1">
    <span>⭐</span>
    <span>{album.avg_rating ?? "—"}</span>
  </div>

      {/* ❤️ Ulubione z tooltipem */}
        <div className="relative group overflow-visible">
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await toggleFavorite(album.id, album.is_favorite);
          }}
          className="text-lg hover:scale-110 transition-transform flex items-center gap-1"
          aria-label="toggle favorite"
        >
          <motion.span
            initial={{ scale: 1 }}
            animate={{ scale: album.is_favorite ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className={album.is_favorite ? "text-red-500" : "text-gray-400"}
          >
            {album.is_favorite ? "❤️" : "🤍"}
          </motion.span>
          <span className="text-xs text-gray-600 dark:text-gray-300 min-w-2.5 text-center">
            {album.favorites_count ?? 0}
          </span>
        </button>

        {/* 🪶 Tooltip */}
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none whitespace-nowrap overflow-visible">
          {album.is_favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          <div className="absolute left-1/2 top-full -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
        </div>
      </div>
    </div>
    </div>

  {/* ✨ Neon border effect */}
  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition duration-700 bg-linear-to-r from-[#1db954] via-[#00b4d8] to-[#7209b7] blur-[6px] -z-10"></div>
</Link>
</motion.div>



          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 dark:text-gray-400">
          <p className="text-6xl mb-3">😕</p>
          <p className="text-lg font-medium">Nie znaleziono żadnych albumów</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Spróbuj zmienić filtr lub wyszukiwanie
          </p>
        </div>
      )}

      {/* 📜 Paginacja */}
      {total && total > limit && (
        <div className="mt-10 flex justify-center items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Poprzednia
          </button>
          <span>
            Strona {page} z {Math.ceil(total / limit)}
          </span>
          <button
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  </main>
);

}