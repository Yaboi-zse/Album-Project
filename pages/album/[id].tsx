// pages/album/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";

export default function AlbumDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [album, setAlbum] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAlbum();
  }, [id]);

  async function fetchAlbum() {
    setLoading(true);

    const { data: albumData, error } = await supabase
      .from("albums")
      .select("id, title, year, cover_url, artists(name)")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setAlbum(albumData);

    // 🟡 Pobierz oceny
    const { data: ratings } = await supabase
      .from("ratings")
      .select("rating")
      .eq("album_id", id);

    if (ratings && ratings.length > 0) {
      const avg =
        ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      setAvgRating(Number(avg.toFixed(1)));
    } else {
      setAvgRating(null);
    }

    // 🟡 Pobierz użytkownika
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (user) {
      const { data: userRatingData } = await supabase
        .from("ratings")
        .select("rating")
        .eq("user_id", user.id)
        .eq("album_id", id)
        .maybeSingle();

      setUserRating(userRatingData?.rating || null);

      const { data: favData } = await supabase
        .from("favorites")
        .select("album_id")
        .eq("user_id", user.id)
        .eq("album_id", id)
        .maybeSingle();

      setIsFavorite(!!favData);
    }

    setLoading(false);
  }

  // ✅ Poprawione zapisywanie oceny
  async function handleRating(rating: number) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) return alert("Musisz być zalogowany, aby ocenić album.");

    const { error } = await supabase
      .from("ratings")
      .upsert(
        {
          user_id: user.id,
          album_id: id,
          rating,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,album_id" } // 🟢 klucz konfliktu
      );

    if (error) {
      console.error("Błąd przy zapisie oceny:", error);
      alert("Nie udało się zapisać oceny.");
    } else {
      setUserRating(rating);
      fetchAlbum(); // odśwież dane
    }
  }

  async function toggleFavorite() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert("Musisz być zalogowany, aby dodać do ulubionych.");

    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("album_id", id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("favorites").insert({ album_id: id, user_id: user.id });
    }

    setIsFavorite(!isFavorite);
  }

  if (loading)
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-20">
        Ładowanie albumu...
      </div>
    );

  if (!album)
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-20">
        Nie znaleziono albumu.
      </div>
    );

  return (
    <main className="px-6 py-10 min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-900 dark:text-gray-100 transition-colors duration-500">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        {/* 🔙 Powrót */}
        <Link
          href="/"
          className="text-blue-500 hover:underline mb-6 self-start flex items-center gap-1"
        >
          ← Powrót
        </Link>

        {/* 💿 Okładka */}
        <img
          src={album.cover_url}
          alt={album.title}
          className="w-64 h-64 rounded-2xl shadow-xl object-cover mb-6 border border-gray-200 dark:border-gray-700"
        />

        {/* 🎵 Tytuł i artysta */}
        <h1 className="text-3xl font-bold text-center mb-1">{album.title}</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
          {album.artists?.name}
        </p>

        {/* ⭐ Ocena i ulubione */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {[...Array(10)].map((_, i) => {
              const rating = i + 1;
              const active = userRating && rating <= userRating;

              return (
                <button
                  key={rating}
                  onClick={() => handleRating(rating)}
                  className={`w-10 h-10 rounded-lg font-bold text-sm flex items-center justify-center transition-all duration-150 shadow-sm
                    ${
                      active
                        ? "bg-linear-to-br from-yellow-400 to-yellow-500 text-black scale-110 shadow-yellow-500/30"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-yellow-300 hover:text-black"
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

        {/* 📊 Informacje */}
        <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 w-full text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            <span className="font-medium">Średnia ocena:</span>{" "}
            {avgRating ? `${avgRating.toFixed(1)}/10` : "—"}
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-medium">Rok wydania:</span>{" "}
            {album.year || "Nieznany"}
          </p>
        </div>
      </div>
    </main>
  );
}
