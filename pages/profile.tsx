// pages/profile.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../src/lib/supabaseClient";
import Link from "next/link";
import Image from "next/image";

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
      console.error("Błąd przy pobieraniu profilu:", error);
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
      console.error("Błąd przy pobieraniu ulubionych:", error);
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
      console.error("Błąd przy pobieraniu ocen:", error);
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
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await getProfile(user.id);
      setAvatarFile(null);

    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Błąd podczas zmiany avataru");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      username: formData.get("username") as string,
      bio: formData.get("bio") as string,
      location: formData.get("location") as string,
    };

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      await getProfile(user.id);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Błąd podczas zapisywania profilu");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-black dark:text-white">
        Ładowanie...
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
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
            ← Powrót
          </Link>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            {isEditing ? "Anuluj" : "Edytuj profil"}
          </button>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6">
          <div className="w-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="relative h-12 w-12 rounded-full overflow-hidden border border-white/10 group"
                  aria-label="Zmień zdjęcie profilowe"
                >
                  <Image
                    src={profile?.avatar_url || "https://placehold.co/200x200?text=🎵"}
                    alt="Avatar"
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm">
                    ✎
                  </span>
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-3xl font-bold">{profile?.username || user?.email?.split("@")[0]}</h1>
                    <span className="text-sm text-gray-600 dark:text-gray-300">•</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Profil</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Lokalizacja: {profile?.location || "Brak lokalizacji"}
                  </p>

                  {avatarFile && (
                    <div className="mt-2 text-xs text-gray-500">Przesyłanie...</div>
                  )}

                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
                      <input
                        name="username"
                        defaultValue={profile?.username || user?.email?.split("@")[0]}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-white/10"
                      />
                      <textarea
                        name="bio"
                        defaultValue={profile?.bio || ""}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-white/10"
                      />
                      <input
                        name="location"
                        defaultValue={profile?.location || ""}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-white/10"
                      />
                      <button type="submit" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">Zapisz</button>
                    </form>
                  ) : (
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      {profile?.bio || "Miłośnik muzyki"}
                    </p>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
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
                    {favoriteAlbums.slice(0, 3).map((album) => (
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
              {recentRatings.slice(0, 5).map((rating) => (
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
