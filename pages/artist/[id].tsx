// pages/artist/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import { AlbumCards } from "../../src/components/AlbumCards";
import * as api from "../../src/lib/api";

type Artist = {
  id: string | number;
  name: string;
  birth_date?: string | null;
  country?: string | null;
  bio?: string | null;
};

export default function ArtistPage() {
  const router = useRouter();
  const { id } = router.query;
  const artistId = typeof id === "string" ? id : undefined;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [allAlbumsPage, setAllAlbumsPage] = useState(0);
  const [avgArtistRating, setAvgArtistRating] = useState<number | null>(null);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  const loadArtistAndAlbums = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);

    const { data: u } = await supabase.auth.getUser();
    setUser(u?.user ?? null);

    const { data: artistData } = await supabase
      .from("artists")
      .select("*")
      .eq("id", artistId)
      .maybeSingle();
    setArtist(artistData ?? null);

    const result = await api.fetchAlbums({
      page: 1,
      limit: 50,
      artistFilter: artistId,
    });
    const artistAlbums = result.albums || [];
    setAlbums(artistAlbums);

    if (artistAlbums.length > 0) {
      const albumIds = artistAlbums.map((a: any) => a.id);
      const { data: ratingRows } = await supabase
        .from("ratings")
        .select("album_id, rating")
        .in("album_id", albumIds);

      const ratings = (ratingRows || []).map((r: any) => Number(r.rating)).filter((n) => !Number.isNaN(n));
      if (ratings.length > 0) {
        const avg = ratings.reduce((s, n) => s + n, 0) / ratings.length;
        setAvgArtistRating(Number(avg.toFixed(1)));
      } else {
        setAvgArtistRating(null);
      }
      setRatingsCount(ratings.length);

      const { data: favRows } = await supabase
        .from("favorites")
        .select("album_id")
        .in("album_id", albumIds);
      setFavoritesCount(favRows?.length ?? 0);
    } else {
      setAvgArtistRating(null);
      setRatingsCount(0);
      setFavoritesCount(0);
    }
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    loadArtistAndAlbums();
  }, [loadArtistAndAlbums]);

  const handleToggleFavorite = async (albumId: string | number, isFavorite: boolean) => {
    if (!user) return alert("Musisz być zalogowany.");
    await api.toggleFavorite(albumId, isFavorite, user.id);
    await loadArtistAndAlbums();
  };

  const handleUpsertRating = async (albumId: string | number, value: number) => {
    if (!user) return alert("Musisz być zalogowany.");
    await api.upsertRating(albumId, value, user.id);
    await loadArtistAndAlbums();
  };

  const allAlbumsPageSize = 3;
  const allAlbumsTotalPages = Math.max(1, Math.ceil(albums.length / allAlbumsPageSize));
  const allAlbumsStart = allAlbumsPage * allAlbumsPageSize;
  const allAlbumsVisible = albums.slice(allAlbumsStart, allAlbumsStart + allAlbumsPageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        Ładowanie...
      </div>
    );
  }

  return (
    <main className="min-h-screen relative bg-gray-100 text-black dark:bg-[#03060a] dark:text-white">
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
          backgroundImage: `url("${albums?.[0]?.cover_url || ""}")`,
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
        >
          ← Powrót
        </button>

        {/* HERO */}
        <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          <aside className="h-full grid grid-rows-2 gap-6">
            <div className="h-full p-3 rounded-xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
              <h3 className="text-lg font-semibold mb-2">🎵 Informacje</h3>
              <p className="font-bold text-black dark:text-white">{artist?.name || "Nieznany artysta"}</p>
              <p className="text-sm mt-2">Data urodzenia: {artist?.birth_date ?? "—"}</p>
              <p className="text-sm">Kraj: {artist?.country ?? "—"}</p>
              {artist?.bio && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 whitespace-pre-line">
                  {artist.bio}
                </p>
              )}
            </div>

            <div className="h-full p-3 rounded-xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
              <h4 className="font-semibold mb-3">Statystyki</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Albumy</p>
                  <p className="text-lg font-bold">{albums.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Średnia ocena</p>
                  <p className="text-lg font-bold">{avgArtistRating ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Oceny</p>
                  <p className="text-lg font-bold">{ratingsCount}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Ulubione</p>
                  <p className="text-lg font-bold">{favoritesCount}</p>
                </div>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-2 h-full grid grid-rows-2 gap-6">
            <div className="h-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-3xl font-bold">{artist?.name || "Nieznany artysta"}</h1>
                <span className="text-sm text-gray-600 dark:text-gray-300">•</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">Albumy artysty</span>
              </div>
              <div className="mt-4">
                <h3 className="text-xl font-semibold mb-4">Top albumy</h3>
                {albums.length > 0 ? (
                  <div
                    className="grid gap-x-6 gap-y-10 justify-items-center sm:justify-items-start"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
                  >
                    {[...albums]
                      .sort((a, b) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0))
                      .slice(0, 3)
                      .map((album) => (
                        <AlbumCards
                          key={album.id}
                          album={album}
                          onToggleFavorite={handleToggleFavorite}
                          onRate={handleUpsertRating}
                          enableRating={false}
                          enableFavorite={false}
                          showStats={false}
                        />
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Brak albumów.</p>
                )}
              </div>
            </div>

            {/* ALL ALBUMS (carousel) */}
            <div className="h-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Wszystkie albumy</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAllAlbumsPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Przewiń w lewo"
                    disabled={allAlbumsPage <= 0}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setAllAlbumsPage((p) => Math.min(allAlbumsTotalPages - 1, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Przewiń w prawo"
                    disabled={allAlbumsPage >= allAlbumsTotalPages - 1}
                  >
                    →
                  </button>
                </div>
              </div>
              {albums.length > 0 ? (
                <div className="grid gap-x-6 gap-y-10 justify-items-center sm:justify-items-start" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {allAlbumsVisible.map((album) => (
                    <AlbumCards
                      key={album.id}
                      album={album}
                      onToggleFavorite={handleToggleFavorite}
                      onRate={handleUpsertRating}
                      enableRating={false}
                      enableFavorite={false}
                      showStats={false}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Brak albumów.</p>
              )}
              {albums.length > 4 && (
                <p className="mt-2 text-xs text-gray-500">
                  Strona {allAlbumsPage + 1} z {allAlbumsTotalPages} 
                </p>
              )}
            </div>
          </section>
        </div>

        {albums.length === 0 && (
          <div className="py-24 text-center text-gray-400">
            Brak albumów tego artysty.
          </div>
        )}
      </div>
    </main>
  );
}
