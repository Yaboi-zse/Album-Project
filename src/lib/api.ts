// src/lib/api.ts

import { supabase } from "./supabaseClient";

// --- DEFINICJE TYPÓW ---
interface AlbumFilters {
  page: number;
  limit: number;
  debouncedSearch?: string;
  genreFilter?: string;
  yearFrom?: string;
  yearTo?: string;
  artistFilter?: string;
  ratingMin?: string;
  sortBy?: string;
}

interface Artist {
  id: number;
  name: string;
}

interface Album {
  id: string | number;
  title: string;
  year: number;
  genre: string | null;
  cover_url: string;
  artist_id: number;
  artists: Artist | { name: string } | null;
}

// --- FUNKCJE API ---

export async function fetchArtists() {
  const { data, error } = await supabase.from("artists").select("id, name").order("name");
  if (error) console.error("Error fetching artists:", error);
  return data || [];
}

export async function fetchGenres() {
  const { data, error } = await supabase.from("albums").select("genre").not("genre", "is", null);
  if (error) {
    console.error("Error fetching genres:", error);
    return [];
  }
  const uniqueGenres = Array.from(new Set(data.flatMap(a => (a.genre || "").split(",").map(g => g.trim()).filter(Boolean)))).sort();
  return uniqueGenres;
}

export async function fetchAlbums(filters: AlbumFilters) {
  const { page, limit, debouncedSearch, genreFilter, yearFrom, yearTo, artistFilter, ratingMin, sortBy } = filters;
  try {
    const offset = (page - 1) * limit;
    let query = supabase.from("albums").select(`id, title, year, genre, cover_url, artist_id, artists(name)`, { count: "exact" });
    if (debouncedSearch) query = query.ilike("title", `%${debouncedSearch}%`);
    if (yearFrom) query = query.gte("year", parseInt(yearFrom));
    if (yearTo) query = query.lte("year", parseInt(yearTo));
    if (artistFilter) query = query.eq("artist_id", artistFilter);
    if (sortBy === "title") query = query.order("title", { ascending: true });
    else query = query.order("year", { ascending: false, nullsFirst: false });
    query = query.range(offset, offset + limit - 1);
    const { data: albumRows, count: totalCount, error: queryError } = await query;
    if (queryError) throw queryError;
    if (!albumRows || albumRows.length === 0) return { albums: [], total: totalCount ?? 0 };
    const albumIds = albumRows.map((r: Album) => r.id);
    const [ratingsRes, favsRes, userRes] = await Promise.all([
      supabase.from("ratings").select("album_id, rating").in("album_id", albumIds),
      supabase.from("favorites").select("album_id, user_id").in("album_id", albumIds),
      supabase.auth.getUser(),
    ]);
    const currentUser = userRes.data?.user;
    let userRatings: any[] = [];
    let userFavs: any[] = [];
    if (currentUser) {
        const [ur, uf] = await Promise.all([
             supabase.from("ratings").select("album_id, rating").eq("user_id", currentUser.id).in("album_id", albumIds),
             supabase.from("favorites").select("album_id").eq("user_id", currentUser.id).in("album_id", albumIds),
        ]);
        userRatings = ur.data || [];
        userFavs = uf.data || [];
    }
    const ratingsByAlbum = (ratingsRes.data || []).reduce((acc, r) => { (acc[r.album_id] = acc[r.album_id] || []).push(Number(r.rating)); return acc; }, {} as Record<string, number[]>);
    const favCount = (favsRes.data || []).reduce((acc, f) => { acc[f.album_id] = (acc[f.album_id] || 0) + 1; return acc; }, {} as Record<string, number>);
    let combined = albumRows.map((a: Album) => ({ ...a, artist_name: (a.artists as any)?.name ?? "Nieznany artysta", avg_rating: (ratingsByAlbum[a.id as string] || []).length > 0 ? Number(((ratingsByAlbum[a.id as string] || []).reduce((s, x) => s + x, 0) / (ratingsByAlbum[a.id as string] || []).length).toFixed(1)) : "—", votes: (ratingsByAlbum[a.id as string] || []).length, favorites_count: favCount[a.id as string] || 0, is_favorite: userFavs.some((f) => f.album_id === a.id), user_rating: userRatings.find((ur) => ur.album_id === a.id) ? Number(userRatings.find((ur) => ur.album_id === a.id).rating) : null }));
    if (ratingMin) combined = combined.filter(album => album.avg_rating !== "—" && Number(album.avg_rating) >= Number(ratingMin));
    if (genreFilter) { const genreList = genreFilter.split(',').map(g => g.trim().toLowerCase()).filter(Boolean); if (genreList.length > 0) combined = combined.filter(album => album.genre && genreList.some(selectedGenre => album.genre!.split(',').map(g => g.trim().toLowerCase()).some(albumGenre => albumGenre.includes(selectedGenre)))); }
    return { albums: combined, total: totalCount ?? 0 };
  } catch (e) {
    console.error("Error in fetchAlbums:", e);
    return { albums: [], total: 0 };
  }
}

export async function fetchTop10Albums() {
  try {
    const { data: ratingsData, error: ratingsError } = await supabase.from("ratings").select("album_id, rating");
    if (ratingsError) throw ratingsError;
    const albumRatings = (ratingsData || []).reduce((acc, rating) => {
      if (!acc[rating.album_id]) acc[rating.album_id] = { sum: 0, count: 0 };
      acc[rating.album_id].sum += rating.rating;
      acc[rating.album_id].count += 1;
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);
    const albumsWithAvgRating = Object.entries(albumRatings).map(([album_id, data]) => ({
      album_id: album_id,
      avg_rating: Number((data.sum / data.count).toFixed(1)),
      votes: data.count
    })).sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 10);
    if (albumsWithAvgRating.length === 0) return [];
    const albumIds = albumsWithAvgRating.map(item => item.album_id);
    const { data: albumsData, error: albumsError } = await supabase.from("albums").select(`id, title, year, genre, cover_url, artists(name)`).in("id", albumIds);
    if (albumsError) throw albumsError;
    if (!albumsData) return [];
    const albumsWithDetails = albumsData.map(album => {
      const ratingInfo = albumsWithAvgRating.find(item => item.album_id === album.id);
      return { ...album, artist_name: (album.artists as any)?.name ?? "Nieznany artysta", avg_rating: ratingInfo?.avg_rating ?? 0, votes: ratingInfo?.votes ?? 0 };
    });
    return albumsWithDetails.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
  } catch (error) {
    console.error("Error fetching top 10 albums:", error);
    return [];
  }
}

export async function fetchNewReleases() {
  const { data, error } = await supabase.from("albums").select(`id, title, cover_url, artists(name)`).order("created_at", { ascending: false }).limit(8);
  if (error) console.error("Error fetching new releases:", error);
  return (data || []).map(album => ({ ...album, artist_name: (album.artists as any)?.name ?? "Nieznany artysta" }));
}

export async function fetchRecommendations(userId: string) {
  if (!userId) return [];
  const { data: myRatings } = await supabase.from("ratings").select("album_id").eq("user_id", userId).gte("rating", 7);
  if (!myRatings || myRatings.length === 0) return [];
  const ratedIds = myRatings.map(r => r.album_id);
  const { data: likedAlbums } = await supabase.from("albums").select("genre").in("id", ratedIds).not("genre", "is", null);
  if (!likedAlbums || likedAlbums.length === 0) return [];
  const genres = Array.from(new Set(likedAlbums.flatMap(a => (a.genre || "").split(",").map(g => g.trim()).filter(Boolean))));
  if (genres.length === 0) return [];
  const orConditions = genres.map(g => `genre.ilike.%${g}%`).join(",");
  const { data: candidates, error } = await supabase.from("albums").select(`id, title, cover_url, artists(name), genre`).or(orConditions).not("id", "in", `(${ratedIds.join(",")})`).limit(10);
  if (error) console.error("Error fetching recommendations:", error);
  return candidates || [];
}

export async function toggleFavorite(albumId: string | number, isCurrentlyFavorite: boolean, userId: string) {
  if (!userId) return;
  const request = isCurrentlyFavorite ? supabase.from("favorites").delete().eq("user_id", userId).eq("album_id", albumId) : supabase.from("favorites").insert({ user_id: userId, album_id: albumId });
  const { error } = await request;
  if (error) console.error("Error toggling favorite:", error);
}

export async function upsertRating(albumId: string | number, ratingValue: number, userId: string) {
    if (!userId) return;
    const { error } = await supabase.from('ratings').upsert({ user_id: userId, album_id: albumId, rating: ratingValue }, { onConflict: 'user_id, album_id' });
    if (error) console.error("Error upserting rating:", error);
}
