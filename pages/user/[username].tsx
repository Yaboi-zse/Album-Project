// pages/user/[username].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import Link from "next/link";

export default function UserProfile() {
  const router = useRouter();
  const { username } = router.query;

  const [userData, setUserData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [totalReviews, setTotalReviews] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (username) {
      fetchUser(username as string);
    }
  }, [username]);

  async function fetchUser(username: string) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, username, avatar_url, bio, location, total_reviews, total_ratings, created_at"
      )
      .eq("username", username)
      .single();

    if (error || !profile) {
      console.error("Nie znaleziono użytkownika:", error);
      setUserData(null);
      setLoading(false);
      return;
    }

    setUserData(profile);
    await Promise.all([
      fetchReviews(profile.id),
      fetchRatings(profile.id),
      fetchCounts(profile.id),
    ]);

    // 🔁 Realtime aktualizacja liczników
    setupRealtimeSubscriptions(profile.id);
  }

  // 🧩 Realtime — subskrypcje na zmiany w reviews/ratings
  function setupRealtimeSubscriptions(userId: string) {
    // Subskrypcja dla recenzji
    const reviewsChannel = supabase
      .channel(`reviews-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `user_id=eq.${userId}` },
        async () => {
          await fetchCounts(userId);
          await fetchReviews(userId);
        }
      )
      .subscribe();

    // Subskrypcja dla ocen
    const ratingsChannel = supabase
      .channel(`ratings-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `user_id=eq.${userId}` },
        async () => {
          await fetchCounts(userId);
          await fetchRatings(userId);
        }
      )
      .subscribe();

    // 🔒 Sprzątanie po odmontowaniu komponentu
    return () => {
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(ratingsChannel);
    };
  }

  async function fetchReviews(userId: string) {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, title, body, created_at, album_id, albums(title, cover_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) console.error("Błąd przy pobieraniu recenzji:", error);
    setReviews(data || []);
  }

  async function fetchRatings(userId: string) {
    const { data, error } = await supabase
      .from("ratings")
      .select("id, rating, album_id, created_at, albums(title, cover_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) console.error("Błąd przy pobieraniu ocen:", error);
    setRatings(data || []);
    setLoading(false);
  }

  // 🔢 Dynamiczne liczenie recenzji i ocen
  async function fetchCounts(userId: string) {
    const [{ count: reviewCount }, { count: ratingCount }] = await Promise.all([
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("ratings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    setTotalReviews(reviewCount || 0);
    setTotalRatings(ratingCount || 0);
  }

  if (loading)
    return (
      <main className="flex items-center justify-center min-h-screen text-gray-400 bg-gray-50 dark:bg-[#0b0e11]">
        Ładowanie profilu...
      </main>
    );

  if (!userData)
    return (
      <main className="flex items-center justify-center min-h-screen text-gray-400 bg-gray-50 dark:bg-[#0b0e11]">
        Nie znaleziono użytkownika.
      </main>
    );

  return (
    <main className="px-6 py-10 min-h-screen bg-gray-50 dark:bg-[#0b0e11] text-gray-900 dark:text-gray-100 transition-colors duration-500">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-blue-500 hover:underline mb-8 inline-flex items-center gap-1"
        >
          ← Powrót
        </Link>

        {/* 🧑‍🎤 Profil */}
        <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8 flex flex-col md:flex-row items-center gap-8 mb-10">
          <img
            src={userData.avatar_url || "/placeholder-avatar.png"}
            alt={userData.username}
            className="w-32 h-32 rounded-full object-cover border border-gray-300 dark:border-gray-700 shadow"
          />
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-3xl font-bold">{userData.username}</h1>
            {userData.location && (
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                📍 {userData.location}
              </p>
            )}
            {userData.bio && (
              <p className="mt-2 text-gray-700 dark:text-gray-300 italic max-w-lg">
                “{userData.bio}”
              </p>
            )}
            <div className="mt-4 flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <p>📝 Recenzji: {totalReviews}</p>
              <p>⭐ Ocen: {totalRatings}</p>
            </div>
          </div>
        </div>

        {/* 💬 Ostatnie recenzje */}
        <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8 mb-10">
          <h2 className="text-xl font-semibold mb-4">🗒️ Ostatnie recenzje</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Użytkownik nie dodał jeszcze żadnych recenzji.
            </p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-[#111418] border border-gray-200 dark:border-gray-700 hover:shadow transition"
                >
                  <Link
                    href={`/album/${r.album_id}`}
                    className="flex items-center gap-4"
                  >
                    <img
                      src={r.albums?.cover_url || "/placeholder.png"}
                      alt={r.albums?.title}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-700"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.title || "(Bez tytułu)"}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {r.body}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Recenzja albumu:{" "}
                        <span className="text-blue-500 hover:underline">
                          {r.albums?.title}
                        </span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ⭐ Ostatnie oceny */}
        <div className="bg-white dark:bg-[#1a1f25] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-4">⭐ Ostatnie oceny</h2>
          {ratings.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Użytkownik nie dodał jeszcze ocen.
            </p>
          ) : (
            <ul className="space-y-4">
              {ratings.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-[#111418] border border-gray-200 dark:border-gray-700 hover:shadow transition"
                >
                  <Link href={`/album/${r.album_id}`} className="flex items-center gap-4">
                    <img
                      src={r.albums?.cover_url || "/placeholder.png"}
                      alt={r.albums?.title}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-700"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.albums?.title || "Nieznany album"}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Ocena:{" "}
                        <span className="text-yellow-500 font-semibold">
                          {r.rating}/10
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
