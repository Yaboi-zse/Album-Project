// pages/username/[username].tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../src/lib/supabaseClient";
import { motion } from "framer-motion";
import Link from "next/link";

const NEON = {
  blue: "#00eaff",
  magenta: "#ff2dff", 
  purple: "#8a2be2",
  cyan: "#00ffd5",
};

const neonGlowStyle = (color: string) => ({
  boxShadow: `0 8px 40px ${color}33, 0 0 18px ${color}66, inset 0 1px 0 ${color}22`,
});

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

      // Znajdź profil po username
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

      // Pobierz ulubione albumy
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

      // Pobierz ostatnie oceny
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
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "radial-gradient(1200px 600px at 10% 10%, rgba(138,43,226,0.06), transparent), radial-gradient(1000px 500px at 90% 90%, rgba(0,234,255,0.04), transparent), #03060a",
          color: "#e6eef8",
        }}
      >
        <div className="text-2xl" style={{ color: NEON.cyan }}>
          Ładowanie profilu...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "radial-gradient(1200px 600px at 10% 10%, rgba(138,43,226,0.06), transparent), radial-gradient(1000px 500px at 90% 90%, rgba(0,234,255,0.04), transparent), #03060a",
          color: "#e6eef8",
        }}
      >
        <div className="text-center">
          <div className="text-2xl mb-4" style={{ color: NEON.magenta }}>❌</div>
          <div className="text-xl mb-4">{error}</div>
          <Link 
            href="/"
            className="px-6 py-3 rounded-xl font-semibold"
            style={{
              background: "linear-gradient(90deg, rgba(0,234,255,0.1), rgba(138,43,226,0.1))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            ← Powrót do strony głównej
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main 
      className="min-h-screen pt-24 pb-10"
      style={{
        background: "radial-gradient(1200px 600px at 10% 10%, rgba(138,43,226,0.06), transparent), radial-gradient(1000px 500px at 90% 90%, rgba(0,234,255,0.04), transparent), #03060a",
        color: "#e6eef8",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-2 rounded-xl transition-all hover:scale-105"
            style={{
              background: "linear-gradient(90deg, rgba(255,0,255,0.08), rgba(0,234,255,0.06))",
              border: "1px solid rgba(255,255,255,0.03)",
              ...neonGlowStyle(NEON.purple),
            }}
          >
            <span className="text-xl">←</span>
            <span className="font-semibold">Strona główna</span>
          </Link>
          
          <div className="text-sm px-3 py-1 rounded-full" style={{ background: "rgba(0,234,255,0.1)", color: NEON.blue }}>
            🌐 Profil publiczny
          </div>
        </div>

        {/* Profile Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 mb-10"
          style={{
            background: "linear-gradient(180deg, rgba(8,10,15,0.9), rgba(8,10,15,0.7))",
            border: "1px solid rgba(255,255,255,0.03)",
            ...neonGlowStyle(NEON.blue),
          }}
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="relative">
              <div 
                className="w-32 h-32 rounded-2xl"
                style={{
                  background: "linear-gradient(45deg, rgba(0,234,255,0.1), rgba(255,45,255,0.1))",
                  border: "2px solid rgba(0,234,255,0.3)",
                  ...neonGlowStyle(NEON.cyan),
                }}
              >
                <img
                  src={profile?.avatar_url || "https://placehold.co/200x200?text=🎵"}
                  alt={`Avatar ${profile?.username}`}
                  className="rounded-2xl object-cover w-full h-full"
                />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold mb-2" style={{ color: "#f7f9ff" }}>
                {profile?.username}
              </h1>
              <p className="text-lg mb-3" style={{ color: NEON.cyan }}>
                {profile?.bio || "Miłośnik muzyki 🎵"}
              </p>
              <p className="flex items-center justify-center md:justify-start gap-2 text-sm" style={{ color: "#9fb6d6" }}>
                📍 {profile?.location || "Nie ustawiono lokalizacji"}
              </p>
              <div className="flex gap-6 mt-4 justify-center md:justify-start">
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: NEON.magenta }}>
                    {favoriteAlbums.length}
                  </div>
                  <div className="text-xs" style={{ color: "#9fb6d6" }}>Ulubione</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: NEON.blue }}>
                    {recentRatings.length}
                  </div>
                  <div className="text-xs" style={{ color: "#9fb6d6" }}>Oceny</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Favorite Albums */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(180deg, rgba(8,10,15,0.8), rgba(8,10,15,0.6))",
              border: "1px solid rgba(255,255,255,0.03)",
              ...neonGlowStyle(NEON.magenta),
            }}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: "#f7f9ff" }}>
              💖 Ulubione albumy
              <span className="text-sm px-2 py-1 rounded-full" style={{ background: "rgba(255,45,255,0.1)", color: NEON.magenta }}>
                {favoriteAlbums.length}
              </span>
            </h2>
            
            {favoriteAlbums.length === 0 ? (
              <p className="text-center py-8" style={{ color: "#9fb6d6" }}>
                Brak ulubionych albumów
              </p>
            ) : (
              <div className="grid gap-4">
                {favoriteAlbums.map((album) => (
                  <a
                    href={`/album/${album.id}`}
                    key={album.id}
                    className="flex items-center gap-4 p-3 rounded-xl transition-all hover:scale-105 group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <img
                      src={album.cover_url}
                      alt={album.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-white transition-colors" style={{ color: "#f8fbff" }}>
                        {album.title}
                      </h3>
                      <p className="text-xs" style={{ color: "#9fb6d6" }}>
                        {album.artist_name}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </motion.section>

          {/* Recent Ratings */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(180deg, rgba(8,10,15,0.8), rgba(8,10,15,0.6))",
              border: "1px solid rgba(255,255,255,0.03)",
              ...neonGlowStyle(NEON.blue),
            }}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3" style={{ color: "#f7f9ff" }}>
              ⭐ Ostatnie oceny
              <span className="text-sm px-2 py-1 rounded-full" style={{ background: "rgba(0,234,255,0.1)", color: NEON.blue }}>
                {recentRatings.length}
              </span>
            </h2>
            
            {recentRatings.length === 0 ? (
              <p className="text-center py-8" style={{ color: "#9fb6d6" }}>
                Brak ocenionych albumów
              </p>
            ) : (
              <div className="grid gap-4">
                {recentRatings.map((rating) => (
                  <a
                    href={`/album/${rating.id}`}
                    key={rating.id}
                    className="flex items-center gap-4 p-3 rounded-xl transition-all hover:scale-105 group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <img
                      src={rating.cover_url}
                      alt={rating.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-white transition-colors" style={{ color: "#f8fbff" }}>
                        {rating.title}
                      </h3>
                      <p className="text-xs" style={{ color: "#9fb6d6" }}>
                        {rating.artist_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: "#ffca28" }}>
                        {rating.rating}/10
                      </div>
                      <div className="text-xs" style={{ color: "#9fb6d6" }}>
                        {rating.date}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </main>
  );
}