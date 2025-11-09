import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabaseClient";
import Link from "next/link";

type AlbumPreview = {
  id: string;
  title: string;
  cover_url: string;
  artist_name: string;
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<AlbumPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("favorites")
      .select(
        `
        albums (
          id,
          title,
          cover_url,
          artists ( name )
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("❌ Błąd ładowania ulubionych:", error);
      setLoading(false);
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

    setFavorites(albums);
    setLoading(false);
  }

  if (loading)
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-10">
        Ładowanie ulubionych...
      </div>
    );

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        💖 Ulubione albumy
      </h1>

      {favorites.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          Nie masz jeszcze ulubionych albumów.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((a) => (
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
    </main>
  );
}
