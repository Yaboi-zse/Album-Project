// pages/profile.tsx
import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabaseClient";
import Link from "next/link";
import Image from "next/image";

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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteAlbums, setFavoriteAlbums] = useState<AlbumPreview[]>([]);
  const [recentRatings, setRecentRatings] = useState<RatingPreview[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;

      if (!u) {
        window.location.href = "/login";
        return;
      }

      setUser(u);
      await getProfile(u.id);
      await getFavorites(u.id);
      await getRecentRatings(u.id);
      setLoading(false);
    };

    loadProfile();
  }, []);

  async function getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ Błąd przy pobieraniu profilu:", error);
      return;
    }

    setProfile(data);
  }

  async function getFavorites(userId: string) {
    const { data, error } = await supabase
      .from("favorites")
      .select(`
        albums (
          id,
          title,
          cover_url,
          artists ( name )
        )
      `)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Błąd przy pobieraniu ulubionych:", error);
      return;
    }

    const albums: AlbumPreview[] =
      data
        ?.map((f: any) => ({
          id: f.albums?.id,
          title: f.albums?.title,
          cover_url: f.albums?.cover_url,
          artist_name: f.albums?.artists?.name ?? "Nieznany artysta",
        }))
        .filter((a: AlbumPreview) => a.id) ?? [];

    setFavoriteAlbums(albums);
  }

  async function getRecentRatings(userId: string) {
    const { data, error } = await supabase
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
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error("❌ Błąd przy pobieraniu ocen:", error);
      return;
    }

    const ratings: RatingPreview[] =
      data
        ?.map((r: any) => ({
          id: r.albums?.id,
          title: r.albums?.title,
          cover_url: r.albums?.cover_url,
          artist_name: r.albums?.artists?.name ?? "Nieznany artysta",
          rating: r.rating,
          date: new Date(r.created_at).toLocaleDateString(),
        }))
        .filter((r: RatingPreview) => r.id) ?? [];

    setRecentRatings(ratings);
  }

  if (loading)
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-10">
        Ładowanie profilu...
      </div>
    );

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline mb-6 block">
        ← Powrót
      </Link>

      {/* Sekcja profilu */}
      {profile && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-10 flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-28 h-28">
            <Image
              src={profile.avatar_url || "https://placehold.co/100x100?text=Avatar"}
              alt="Avatar"
              width={100}
              height={100}
              className="rounded-full border-2 border-gray-300 dark:border-gray-700 object-cover"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.username || user.email}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {profile.bio || "Brak opisu"}
            </p>
            <p className="text-gray-500 dark:text-gray-500">
              {profile.location || "Brak lokalizacji"}
            </p>
          </div>
        </div>
      )}

      {/* Ulubione albumy */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          💖 Ulubione albumy
        </h3>
        {favoriteAlbums.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Brak ulubionych albumów.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {favoriteAlbums.map((a) => (
              <Link
                href={`/album/${a.id}`}
                key={a.id}
                className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition rounded-xl overflow-hidden"
              >
                <img
                  src={a.cover_url}
                  alt={a.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-3">
                  <h4 className="font-semibold">{a.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {a.artist_name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Ocenione */}
      <section>
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          ⭐ Ostatnio ocenione
        </h3>
        {recentRatings.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Brak ocenionych albumów.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {recentRatings.map((r) => (
              <Link
                href={`/album/${r.id}`}
                key={r.id}
                className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition rounded-xl overflow-hidden"
              >
                <img
                  src={r.cover_url}
                  alt={r.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-3">
                  <h4 className="font-semibold">{r.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {r.artist_name}
                  </p>
                  <p className="text-yellow-500">⭐ {r.rating}</p>
                  <p className="text-xs text-gray-400">{r.date}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
