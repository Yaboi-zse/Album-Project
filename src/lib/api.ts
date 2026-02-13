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
  year?: number;
  genre?: string | null;
  cover_url: string;
  artist_id?: number;
  artists: { name: string }[] | { name: string } | null;
}

interface Track {
  id: string | number;
  title: string;
  album_id?: string | number | null;
  spotify_id?: string | null;
  cover_url?: string | null;
  artist_name?: string | null;
  artists?: { name: string }[] | { name: string } | null;
}

// --- FUNKCJE API ---

export async function fetchArtists() {
  const { data, error } = await supabase.from("artists").select("id, name").order("name");
  if (error) console.error("Error fetching artists:", error);
  return data || [];
}

export async function fetchGenres() {
  const { data, error } = await supabase.from("available_genres").select("genre").order("genre", { ascending: true });
  if (error) {
    console.error("Error fetching genres from view:", error);
    return [];
  }
  return (data || [])
    .map((row: { genre?: string | null }) => (row.genre || "").trim())
    .filter(Boolean);
}

export async function fetchAlbums(filters: AlbumFilters) {
  const { page, limit, debouncedSearch, genreFilter, yearFrom, yearTo, artistFilter, ratingMin, sortBy } = filters;
  try {
    const offset = (page - 1) * limit;
    const selectedGenres = (genreFilter || "")
      .split(",")
      .map((g: string) => g.trim().toLowerCase())
      .filter(Boolean);
    let query = supabase.from("albums").select(`id, title, year, genre, cover_url, artist_id, spotify_id, artists(name)`, { count: "exact" });
    if (debouncedSearch) {
      const normalizeQuery = (value: string) =>
        value
          .replace(/\(feat\.[^)]*\)?/gi, "")
          .replace(/\(ft\.[^)]*\)?/gi, "")
          .replace(/\[feat\.[^\]]*\]?/gi, "")
          .replace(/\[ft\.[^\]]*\]?/gi, "")
          .replace(/feat\.[^,)]*/gi, "")
          .replace(/ft\.[^,)]*/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      const normalized = normalizeQuery(debouncedSearch);
      const noCloseParen = debouncedSearch.replace(/\)/g, "");
      const safeSearch = debouncedSearch.replace(/[()]/g, "");
      const artistSearch = normalized || safeSearch || noCloseParen || debouncedSearch;
      const hasFeat = /\b(feat\.|ft\.)/i.test(debouncedSearch);

      const { data: artistRows } = await supabase
        .from("artists")
        .select("id")
        .ilike("name", `%${artistSearch}%`)
        .limit(25);
      const artistIds = (artistRows || []).map((r: { id: number }) => r.id);

      const orParts = [
        `title.ilike.%${safeSearch || debouncedSearch}%`,
      ];
      if (!hasFeat) {
        orParts.push(`genre.ilike.%${safeSearch || debouncedSearch}%`);
      }
      if (!hasFeat && normalized && normalized !== debouncedSearch) {
        orParts.push(`title.ilike.%${normalized}%`);
      }
      if (noCloseParen && noCloseParen !== debouncedSearch) {
        orParts.push(`title.ilike.%${noCloseParen}%`);
      }
      if (!hasFeat && artistIds.length > 0) {
        orParts.push(`artist_id.in.(${artistIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }
    if (yearFrom) query = query.gte("year", parseInt(yearFrom));
    if (yearTo) query = query.lte("year", parseInt(yearTo));
    if (artistFilter) query = query.eq("artist_id", artistFilter);
    // Keep DB order deterministic, but final ordering is applied after votes are computed.
    if (sortBy === "title") query = query.order("title", { ascending: true });
    else query = query.order("year", { ascending: false, nullsFirst: false });
    const { data: albumRows, count: totalCount, error: queryError } = await query;
    if (queryError) throw queryError;
    if (!albumRows || albumRows.length === 0) return { albums: [], total: totalCount ?? 0 };
    const filteredRows =
      selectedGenres.length === 0
        ? albumRows
        : albumRows.filter((row: any) => {
            const rowGenre = String(row.genre || "").toLowerCase();
            if (!rowGenre) return false;
            return selectedGenres.some((g) => rowGenre.includes(g));
          });
    if (filteredRows.length === 0) return { albums: [], total: 0 };

    // Group by spotify_id to avoid duplicates, but keep stats merged across duplicate rows.
    const groupedMap = new Map<string, any[]>();
    for (const row of filteredRows) {
      const key = row.spotify_id ? `s:${row.spotify_id}` : `id:${row.id}`;
      const existing = groupedMap.get(key);
      if (existing) existing.push(row);
      else groupedMap.set(key, [row]);
    }
    const groupedRows = Array.from(groupedMap.entries()).map(([key, rows]) => {
      const representative = [...rows].sort((a, b) => {
        const yearDiff = Number(b.year || 0) - Number(a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        const coverDiff = Number(Boolean(b.cover_url)) - Number(Boolean(a.cover_url));
        if (coverDiff !== 0) return coverDiff;
        return String(a.id || "").localeCompare(String(b.id || ""), "pl", { sensitivity: "base" });
      })[0];
      return { key, rows, representative };
    });

    const albumIds = filteredRows.map((r: { id: string | number }) => r.id);
    const chunkSize = 200;
    const chunkedIds: Array<(string | number)[]> = [];
    for (let i = 0; i < albumIds.length; i += chunkSize) {
      chunkedIds.push(albumIds.slice(i, i + chunkSize));
    }

    const [ratingsChunks, favsChunks, userRes] = await Promise.all([
      Promise.all(
        chunkedIds.map((ids) =>
          supabase.from("ratings").select("album_id, rating").in("album_id", ids)
        )
      ),
      Promise.all(
        chunkedIds.map((ids) =>
          supabase.from("favorites").select("album_id, user_id").in("album_id", ids)
        )
      ),
      supabase.auth.getUser(),
    ]);

    const ratingsData = ratingsChunks.flatMap((res) => {
      if (res.error) throw res.error;
      return res.data || [];
    });
    const favoritesData = favsChunks.flatMap((res) => {
      if (res.error) throw res.error;
      return res.data || [];
    });

    const currentUser = userRes.data?.user;
    let userRatings: any[] = [];
    let userFavs: any[] = [];
    if (currentUser) {
      const [userRatingsChunks, userFavChunks] = await Promise.all([
        Promise.all(
          chunkedIds.map((ids) =>
            supabase
              .from("ratings")
              .select("album_id, rating")
              .eq("user_id", currentUser.id)
              .in("album_id", ids)
          )
        ),
        Promise.all(
          chunkedIds.map((ids) =>
            supabase
              .from("favorites")
              .select("album_id")
              .eq("user_id", currentUser.id)
              .in("album_id", ids)
          )
        ),
      ]);

      userRatings = userRatingsChunks.flatMap((res) => {
        if (res.error) throw res.error;
        return res.data || [];
      });
      userFavs = userFavChunks.flatMap((res) => {
        if (res.error) throw res.error;
        return res.data || [];
      });
    }
    const ratingsByAlbum = ratingsData.reduce((acc, r: any) => {
      const key = String(r.album_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(Number(r.rating));
      return acc;
    }, {} as Record<string, number[]>);
    const favCount = favoritesData.reduce((acc, f) => {
      const key = String(f.album_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const userFavSet = new Set((userFavs || []).map((f: any) => String(f.album_id)));
    const userRatingByAlbum = (userRatings || []).reduce((acc, ur: any) => {
      const key = String(ur.album_id);
      acc[key] = Number(ur.rating);
      return acc;
    }, {} as Record<string, number>);

    let combined = groupedRows.map((group) => {
      const rowIds = group.rows.map((r: any) => String(r.id));
      const groupRatings = rowIds.flatMap((id) => ratingsByAlbum[id] || []);
      const votes = groupRatings.length;
      const avgRating =
        votes > 0
          ? Number((groupRatings.reduce((s, x) => s + x, 0) / votes).toFixed(1))
          : "—";
      const favoritesCount = rowIds.reduce((sum, id) => sum + Number(favCount[id] || 0), 0);
      const isFavorite = rowIds.some((id) => userFavSet.has(id));
      const userRatingsForGroup = rowIds
        .map((id) => userRatingByAlbum[id])
        .filter((v) => typeof v === "number" && !Number.isNaN(v));
      const userRating =
        userRatingsForGroup.length > 0 ? Number(userRatingsForGroup[userRatingsForGroup.length - 1]) : null;
      const a: Album = group.representative;

      return {
        ...a,
        artist_name: Array.isArray(a.artists) ? a.artists[0]?.name ?? "Nieznany artysta" : a.artists?.name ?? "Nieznany artysta",
        avg_rating: avgRating,
        votes,
        favorites_count: favoritesCount,
        is_favorite: isFavorite,
        user_rating: userRating,
      };
    });
    if (ratingMin && Number(ratingMin) > 0) {
      combined = combined.filter(
        (album) => album.avg_rating !== "—" && Number(album.avg_rating) >= Number(ratingMin)
      );
    }
    combined = combined.sort((a, b) => {
      const aVotes = Number(a.votes || 0);
      const bVotes = Number(b.votes || 0);
      const aHasVotes = aVotes > 0;
      const bHasVotes = bVotes > 0;

      if (aHasVotes && bHasVotes) {
        const votesDiff = bVotes - aVotes;
        if (votesDiff !== 0) return votesDiff;
        return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
      }

      if (aHasVotes !== bHasVotes) return aHasVotes ? -1 : 1;

      return String(a.title || "").localeCompare(String(b.title || ""), "pl", { sensitivity: "base" });
    });
    const paginated = combined.slice(offset, offset + limit);
    return { albums: paginated, total: combined.length || totalCount || 0 };
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
    const albumsWithDetails = albumsData.map((album: Album) => {
      const ratingInfo = albumsWithAvgRating.find(item => item.album_id === album.id);
      return { ...album, artist_name: Array.isArray(album.artists) ? album.artists[0]?.name ?? "Nieznany artysta" : album.artists?.name ?? "Nieznany artysta", avg_rating: ratingInfo?.avg_rating ?? 0, votes: ratingInfo?.votes ?? 0 };
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
  return (data || []).map((album: Album) => ({ ...album, artist_name: Array.isArray(album.artists) ? album.artists[0]?.name ?? "Nieznany artysta" : album.artists?.name ?? "Nieznany artysta" }));
}

export async function fetchRecommendations(userId: string) {
  if (!userId) return [];

  const splitGenres = (value?: string | null) =>
    (value || "")
      .split(",")
      .map((g: string) => g.trim().toLowerCase())
      .filter(Boolean);

  const { data: myRatings, error: myRatingsError } = await supabase
    .from("ratings")
    .select("album_id, rating")
    .eq("user_id", userId);
  if (myRatingsError) {
    console.error("Error fetching user ratings for recommendations:", myRatingsError);
    return [];
  }
  if (!myRatings || myRatings.length === 0) return [];

  const ratedIds = Array.from(
    new Set(
      myRatings
        .map((r: any) => r.album_id)
        .filter(Boolean)
        .map((id: string | number) => String(id))
    )
  );
  if (ratedIds.length === 0) return [];

  const ratingByAlbum = new Map<string, number>();
  for (const r of myRatings) {
    const albumId = String((r as any).album_id || "");
    const rating = Number((r as any).rating || 0);
    if (!albumId || Number.isNaN(rating)) continue;
    ratingByAlbum.set(albumId, rating);
  }

  const { data: ratedAlbums, error: ratedAlbumsError } = await supabase
    .from("albums")
    .select("id, genre")
    .in("id", ratedIds);
  if (ratedAlbumsError) {
    console.error("Error fetching rated albums for recommendations:", ratedAlbumsError);
    return [];
  }
  if (!ratedAlbums || ratedAlbums.length === 0) return [];

  const genreWeights = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  for (const album of ratedAlbums) {
    const albumId = String((album as any).id || "");
    const rating = Number(ratingByAlbum.get(albumId) || 0);
    if (rating < 6) continue; // rekomenduj po lubianych gatunkach

    const genres = splitGenres((album as any).genre);
    const weight = Math.max(1, rating - 5);
    for (const genre of genres) {
      genreWeights.set(genre, Number(genreWeights.get(genre) || 0) + weight);
      genreCounts.set(genre, Number(genreCounts.get(genre) || 0) + 1);
    }
  }

  // Fallback: jeśli user ma tylko niskie oceny albo brak gatunków na wysoko ocenianych.
  if (genreWeights.size === 0) {
    for (const album of ratedAlbums) {
      const genres = splitGenres((album as any).genre);
      for (const genre of genres) {
        genreWeights.set(genre, Number(genreWeights.get(genre) || 0) + 1);
        genreCounts.set(genre, Number(genreCounts.get(genre) || 0) + 1);
      }
    }
  }

  if (genreWeights.size === 0) return [];

  const topGenres = [...genreWeights.entries()]
    .sort((a, b) => {
      const scoreDiff = Number(b[1] || 0) - Number(a[1] || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return Number(genreCounts.get(b[0]) || 0) - Number(genreCounts.get(a[0]) || 0);
    })
    .slice(0, 8);
  if (topGenres.length === 0) return [];

  const ratedSet = new Set(ratedIds);
  const candidateMap = new Map<string, any>();

  await Promise.all(
    topGenres.map(async ([genre]) => {
      const { data, error } = await supabase
        .from("albums")
        .select("id, title, cover_url, genre, artist_name, artists(name)")
        .ilike("genre", `%${genre}%`)
        .limit(120);

      if (error) {
        console.error(`Error fetching candidate recommendations for genre "${genre}":`, error);
        return;
      }

      for (const album of data || []) {
        const key = String((album as any).id || "");
        if (!key || ratedSet.has(key)) continue;
        if (!candidateMap.has(key)) candidateMap.set(key, album);
      }
    })
  );

  const candidates = Array.from(candidateMap.values());
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c: any) => c.id).filter(Boolean);
  const votesByAlbum = new Map<string, number>();
  if (candidateIds.length > 0) {
    const { data: ratingsRows, error: ratingsRowsError } = await supabase
      .from("ratings")
      .select("album_id")
      .in("album_id", candidateIds);
    if (!ratingsRowsError) {
      for (const row of ratingsRows || []) {
        const key = String((row as any).album_id || "");
        if (!key) continue;
        votesByAlbum.set(key, Number(votesByAlbum.get(key) || 0) + 1);
      }
    }
  }

  const weightMap = new Map(topGenres);
  const scored = candidates
    .map((album: any) => {
      const genres = splitGenres(album.genre);
      const matchCount = genres.filter((g) => weightMap.has(g)).length;
      const score = genres.reduce((sum, g) => sum + Number(weightMap.get(g) || 0), 0);
      const artistName = Array.isArray(album.artists)
        ? album.artists[0]?.name ?? album.artist_name ?? "Nieznany artysta"
        : album.artists?.name ?? album.artist_name ?? "Nieznany artysta";
      return {
        ...album,
        artist_name: artistName,
        _genreScore: score,
        _genreMatchCount: matchCount,
        _votes: Number(votesByAlbum.get(String(album.id)) || 0),
      };
    })
    .filter((album: any) => album._genreScore > 0 || album._genreMatchCount > 0);

  return scored
    .sort((a: any, b: any) => {
      const scoreDiff = Number(b._genreScore || 0) - Number(a._genreScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const matchDiff = Number(b._genreMatchCount || 0) - Number(a._genreMatchCount || 0);
      if (matchDiff !== 0) return matchDiff;
      const votesDiff = Number(b._votes || 0) - Number(a._votes || 0);
      if (votesDiff !== 0) return votesDiff;
      return String(a.title || "").localeCompare(String(b.title || ""), "pl", { sensitivity: "base" });
    })
    .slice(0, 10)
    .map((album: any) => {
      const { _genreScore, _genreMatchCount, _votes, ...clean } = album;
      return clean;
    });
}

export async function fetchTopSingles(limit = 5) {
  try {
    const { data: recentRatings, error: recentError } = await supabase
      .from("track_ratings")
      .select("track_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (recentError) throw recentError;

    const orderedTrackIds: string[] = [];
    const seen = new Set<string>();
    for (const r of recentRatings || []) {
      const id = r.track_id as string;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orderedTrackIds.push(id);
      if (orderedTrackIds.length >= limit) break;
    }

    if (orderedTrackIds.length === 0) return [];

    const { data: ratingsData, error: ratingsError } = await supabase
      .from("track_ratings")
      .select("track_id, rating")
      .in("track_id", orderedTrackIds);
    if (ratingsError) throw ratingsError;

    const trackRatings = (ratingsData || []).reduce((acc, rating) => {
      if (!acc[rating.track_id]) acc[rating.track_id] = { sum: 0, count: 0 };
      acc[rating.track_id].sum += rating.rating;
      acc[rating.track_id].count += 1;
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);

    const tracksWithAvg = orderedTrackIds.map((track_id) => {
      const data = trackRatings[track_id] || { sum: 0, count: 0 };
      return {
        track_id,
        avg_rating: data.count ? Number((data.sum / data.count).toFixed(1)) : 0,
        votes: data.count,
      };
    });

    const trackIds = tracksWithAvg.map((item) => item.track_id);
    const { data: tracksData, error: tracksError } = await supabase
      .from("tracks")
      .select("id, title, album_id, spotify_id, artist_name, albums(cover_url, artist_name, artists(name))")
      .in("id", trackIds);
    if (tracksError) throw tracksError;
    if (!tracksData) return [];

    const enriched = await Promise.all(
      tracksData.map(async (track: Track) => {
        const ratingInfo = tracksWithAvg.find((item) => item.track_id === track.id);
        const album = (track as any).albums ?? null;
        let artistName =
          track.artist_name ??
          album?.artist_name ??
          (Array.isArray(album?.artists) ? album?.artists?.[0]?.name : album?.artists?.name) ??
          null;
        let coverUrl = album?.cover_url ?? null;

        if ((!artistName || !coverUrl) && track.spotify_id) {
          try {
            const res = await fetch(
              `/api/spotify/track?track_id=${encodeURIComponent(track.spotify_id)}`
            );
            if (res.ok) {
              const t = await res.json();
              const primaryArtist = Array.isArray(t.artists) ? t.artists[0] : null;
              artistName = artistName ?? primaryArtist?.name ?? null;
              coverUrl = coverUrl ?? t.album?.images?.[0]?.url ?? null;
            }
          } catch {}
        }

        return {
          ...track,
          cover_url: coverUrl ?? null,
          artist_name: artistName ?? "Nieznany artysta",
          avg_rating: ratingInfo?.avg_rating ?? 0,
          votes: ratingInfo?.votes ?? 0,
        };
      })
    );

    // keep order by most recent rating
    const orderMap = new Map(trackIds.map((id, idx) => [String(id), idx]));
    return enriched.sort(
      (a, b) => (orderMap.get(String(a.id)) ?? 0) - (orderMap.get(String(b.id)) ?? 0)
    );
  } catch (error) {
    console.error("Error fetching top singles:", error);
    return [];
  }
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
