// pages/username/[username].tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";

const FALLBACK_BG = "https://placehold.co/1200x800?text=music";

type AlbumPreview = {
  id: string;
  title: string;
  cover_url: string;
  artist_name: string;
};

type RatingPreview = AlbumPreview & {
  rating: number;
  date: string;
};

export default function PublicProfilePage() {
  const router = useRouter();
  const { username } = router.query;

  const [profile, setProfile] = useState<any>(null);
  const [favoriteAlbums, setFavoriteAlbums] = useState<AlbumPreview[]>([]);
  const [recentRatings, setRecentRatings] = useState<RatingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      loadPublicProfile(username as string);
    }
  }, [username]);

  async function loadPublicProfile(usernameParam: string) {
    try {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", usernameParam)
        .single();

      if (profileError || !profileData) {
        setError("Profil nie został znaleziony");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: favoritesData } = await supabase
        .from("favorites")
        .select(`
          albums (
            id,
            title,
            cover_url,
            artists ( name )
          )
        `)
        .eq("user_id", profileData.id);

      const albums: AlbumPreview[] =
        favoritesData
          ?.map((f: any) => ({
            id: f.albums?.id,
            title: f.albums?.title,
            cover_url: f.albums?.cover_url,
            artist_name: f.albums?.artists?.name ?? "Nieznany artysta",
          }))
          .filter((a: AlbumPreview) => a.id) ?? [];

      setFavoriteAlbums(albums);

      const { data: ratingsData } = await supabase
        .from("ratings")
        .select(`
          rating,
          created_at,
          albums (
            id,
            title,
            cover_url,
            artists ( name )
          )
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false })
        .limit(8);

      const ratings: RatingPreview[] =
        ratingsData
          ?.map((r: any) => ({
            id: r.albums?.id,
            title: r.albums?.title,
            cover_url: r.albums?.cover_url,
            artist_name: r.albums?.artists?.name ?? "Nieznany artysta",
            rating: r.rating,
            date: new Date(r.created_at).toLocaleDateString("pl-PL"),
          }))
          .filter((r: RatingPreview) => r.id) ?? [];

      setRecentRatings(ratings);

    } catch (err) {
      console.error("Error loading public profile:", err);
      setError("Wystąpił błąd podczas ładowania profilu");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        Ładowanie...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        <div className="text-center">
          <div className="text-xl mb-4">{error}</div>
          <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
            ← Powrót
          </Link>
        </div>
      </div>
    );
  }

  const bgImage = profile?.avatar_url || favoriteAlbums[0]?.cover_url || FALLBACK_BG;

  return (
    <main className="min-h-screen relative bg-gray-100 text-black dark:bg-[#03060a] dark:text-white">
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 dark:opacity-20 pointer-events-none"
        style={{ backgroundImage: `url("${bgImage}")` }}
      />
      <div className="absolute inset-0 bg-white/50 dark:bg-black/40 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
            ← Powrót
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">Profil publiczny</span>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6">
          <div className="w-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full overflow-hidden border border-white/10">
                <img
                  src={profile?.avatar_url || "https://placehold.co/200x200?text=🎵"}
                  alt={`Avatar ${profile?.username}`}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-3xl font-bold">{profile?.username}</h1>
                  <span className="text-sm text-gray-600 dark:text-gray-300">•</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Profil publiczny</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Lokalizacja: {profile?.location || "—"}
                </p>
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  {profile?.bio || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <aside className="h-full">
              <div className="h-full p-4 rounded-xl bg-white/60 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
                <h4 className="font-semibold mb-3">Statystyki</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Ulubione</p>
                    <p className="text-lg font-bold">{favoriteAlbums.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Oceny</p>
                    <p className="text-lg font-bold">{recentRatings.length}</p>
                  </div>
                </div>
              </div>
            </aside>

            <section className="lg:col-span-2 h-full">
              <div className="h-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
                <h3 className="text-xl font-semibold mb-4">Ulubione albumy</h3>
                {favoriteAlbums.length > 0 ? (
                  <div className="grid gap-x-6 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    {favoriteAlbums.slice(0, 4).map((album) => (
                      <Link key={album.id} href={`/album/${album.id}`} className="block">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition">
                          <img src={album.cover_url} className="w-12 h-12 rounded object-cover" alt={album.title} />
                          <div>
                            <p className="font-semibold text-sm line-clamp-1">{album.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{album.artist_name}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Brak ulubionych albumów.</p>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
          <h3 className="text-xl font-semibold mb-4">Ostatnie oceny</h3>
          {recentRatings.length > 0 ? (
            <div className="grid gap-x-6 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {recentRatings.slice(0, 6).map((rating) => (
                <Link key={rating.id} href={`/album/${rating.id}`} className="block">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition">
                    <img src={rating.cover_url} className="w-12 h-12 rounded object-cover" alt={rating.title} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm line-clamp-1">{rating.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{rating.artist_name}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">{rating.rating}/10</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Brak ocenionych albumów.</p>
          )}
        </div>
      </div>
    </main>
  );
}
