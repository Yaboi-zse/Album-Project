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
      const p_offset = (page - 1) * limit
      let query = supabase
        .from('albums')
        .select(`id, title, year, cover_url, artist_id, artists(name)`)
        .range(p_offset, p_offset + limit - 1)
        .order(sortBy)

      if (artistFilter) query = query.eq('artist_id', artistFilter)
      if (genreFilter && genreFilter !== '__NO_GENRE__') query = query.eq('genre', genreFilter)

      const { data: rows, error } = await query
      if (error) return

      const albums = (rows || []).map((a: any) => ({
        ...a,
        artist_name: a.artists?.name || 'Nieznany artysta',
      }))

      const { data: ratings } = await supabase
        .from('ratings')
        .select('album_id, rating')
        .in('album_id', albums.map((a) => a.id))

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      let favorites: any[] = []
      if (user) {
        const { data: favs } = await supabase.from('favorites').select('album_id').eq('user_id', user.id)
        favorites = favs || []
      }

      const combined = albums.map((a) => {
        const r = ratings?.filter((x) => x.album_id === a.id) || []
        const avg =
          r.length > 0 ? (r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1) : '—'
        return {
          ...a,
          avg_rating: avg,
          votes: r.length,
          is_favorite: favorites.some((f) => f.album_id === a.id),
        }
      })

      setAlbums(combined)
    } catch (e) {
      console.error(e)
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
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 transition-all">
          {albums.map((album, i) => (
<motion.div
  key={album.id}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.03 }}
>
  <Link
    href={`/album/${album.id}`}
    className="block group bg-white dark:bg-[#181c22] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02]"
  >
    {/* 🖼️ Okładka z ocenami */}
        <div className="relative overflow-hidden bg-black">
          {album.cover_url ? (
            <img
              src={album.cover_url}
              alt={album.title}
              className="w-full h-52 object-cover block"
            />
          ) : (
            <div className="w-full h-52 bg-gray-200 dark:bg-[#2b3038] flex items-center justify-center text-gray-500 dark:text-gray-400">
              Brak okładki
            </div>
          )}

      {/* ⭐ Hover oceny tylko na okładce */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/90 to-transparent z-30">
        <p className="text-gray-200 text-sm mb-1">Oceń album</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {[...Array(10)].map((_, idx) => {
            const rating = idx + 1;
            return (
              <button
                key={rating}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const { data: userData } = await supabase.auth.getUser();
                  const user = userData?.user;
                  if (!user)
                    return alert("Musisz być zalogowany, aby ocenić album.");
                  await supabase
                    .from("ratings")
                    .upsert({ user_id: user.id, album_id: album.id, rating });
                  fetchAlbums();
                }}
                className="w-6 h-6 rounded-full text-[10px] font-bold bg-gray-200/80 dark:bg-[#2b3038]/80 text-gray-900 dark:text-gray-100 hover:bg-yellow-400 hover:text-black transition-all duration-150"
              >
                {rating}
              </button>
            );
          })}
        </div>
      </div>
    </div>

    {/* 📄 Info o albumie */}
    <div className="p-4 flex flex-col justify-between text-center">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-1">
          {album.title}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {album.artist_name || "Nieznany artysta"}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-yellow-500">⭐ {album.avg_rating ?? "—"}</div>
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await toggleFavorite(album.id, album.is_favorite);
          }}
          className="text-lg hover:scale-110 transition-transform"
          aria-label="toggle favorite"
        >
          {album.is_favorite ? "❤️" : "🤍"}
        </button>
      </div>
    </div>
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