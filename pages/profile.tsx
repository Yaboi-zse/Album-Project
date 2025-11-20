// pages/profile.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

// Neon palette
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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteAlbums, setFavoriteAlbums] = useState<AlbumPreview[]>([]);
  const [recentRatings, setRecentRatings] = useState<RatingPreview[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          date: new Date(r.created_at).toLocaleDateString("pl-PL"),
        }))
        .filter((r: RatingPreview) => r.id) ?? [];

    setRecentRatings(ratings);
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarFile(file);
    
    try {
      // Upload avatar to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh profile
      await getProfile(user.id);
      setAvatarFile(null);
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Błąd podczas zmiany avataru');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      username: formData.get('username') as string,
      bio: formData.get('bio') as string,
      location: formData.get('location') as string,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      await getProfile(user.id);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Błąd podczas zapisywania profilu');
    }
  };

  if (loading)
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
            <span className="font-semibold">Powrót do strony głównej</span>
          </Link>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-6 py-2 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              background: isEditing 
                ? "linear-gradient(90deg, rgba(255,45,255,0.15), rgba(0,234,255,0.1))"
                : "linear-gradient(90deg, rgba(0,234,255,0.1), rgba(138,43,226,0.1))",
              border: "1px solid rgba(255,255,255,0.08)",
              ...neonGlowStyle(isEditing ? NEON.magenta : NEON.blue),
            }}
          >
            {isEditing ? "❌ Anuluj" : "✏️ Edytuj profil"}
          </button>
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
            <div className="relative group">
              <div 
                className="w-32 h-32 rounded-2xl cursor-pointer transition-all duration-300 group-hover:scale-110"
                style={{
                  background: "linear-gradient(45deg, rgba(0,234,255,0.1), rgba(255,45,255,0.1))",
                  border: "2px solid rgba(0,234,255,0.3)",
                  ...neonGlowStyle(NEON.cyan),
                }}
                onClick={handleAvatarClick}
              >
                <Image
                  src={profile?.avatar_url || "https://placehold.co/200x200?text=🎵"}
                  alt="Avatar"
                  width={128}
                  height={128}
                  className="rounded-2xl object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-semibold">📷</span>
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              {avatarFile && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                  Przesyłanie...
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ color: NEON.cyan }}>
                      Nazwa użytkownika
                    </label>
                    <input
                      name="username"
                      defaultValue={profile?.username || user?.email?.split('@')[0]}
                      className="w-full px-4 py-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e6eef8",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: NEON.cyan }}>
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      defaultValue={profile?.bio || ""}
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e6eef8",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: NEON.cyan }}>
                      Lokalizacja
                    </label>
                    <input
                      name="location"
                      defaultValue={profile?.location || ""}
                      className="w-full px-4 py-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e6eef8",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105"
                    style={{
                      background: "linear-gradient(90deg, rgba(0,234,255,0.15), rgba(138,43,226,0.15))",
                      border: "1px solid rgba(255,255,255,0.08)",
                      ...neonGlowStyle(NEON.blue),
                    }}
                  >
                    💾 Zapisz zmiany
                  </button>
                </form>
              ) : (
                <>
                  <h1 className="text-4xl font-bold mb-2" style={{ color: "#f7f9ff" }}>
                    {profile?.username || user?.email?.split('@')[0]}
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
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
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
                Brak ulubionych albumów. Zacznij dodawać! ❤️
              </p>
            ) : (
              <div className="grid gap-4">
                {favoriteAlbums.slice(0, 4).map((album) => (
                  <Link
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
                  </Link>
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
                Brak ocenionych albumów. Zacznij oceniać! ⭐
              </p>
            ) : (
              <div className="grid gap-4">
                {recentRatings.slice(0, 4).map((rating) => (
                  <Link
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
                  </Link>
                ))}
              </div>
            )}
          </motion.section>
        </div>

        {/* Public Profile Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Link
            href={`/username/${profile?.username || user?.email?.split('@')[0]}`}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold transition-all hover:scale-105"
            style={{
              background: "linear-gradient(90deg, rgba(138,43,226,0.15), rgba(0,234,255,0.15))",
              border: "1px solid rgba(255,255,255,0.08)",
              ...neonGlowStyle(NEON.purple),
            }}
          >
            🌐 Publiczny profil
            <span className="text-sm px-2 py-1 rounded-full" style={{ background: "rgba(138,43,226,0.2)", color: NEON.purple }}>
              Nowość
            </span>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}