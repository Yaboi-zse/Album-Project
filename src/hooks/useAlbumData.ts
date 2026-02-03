// src/hooks/useAlbumData.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

// Import all API functions
import * as api from '../lib/api';

// Prosty hook do debouncingu, możemy go trzymać tutaj lub w osobnym pliku
function useDebounced<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}


interface Filters {
  page: number;
  search?: string; // search jest teraz w tym hooku
  genreFilter?: string;
  yearFrom?: string;
  yearTo?: string;
  artistFilter?: string;
  ratingMin?: string;
  sortBy?: string;
}

interface Album {
  id: string | number;
  title: string;
  cover_url: string;
  [key: string]: any;
}


export function useAlbumData(filters: Omit<Filters, 'search'> & { search?: string }, limit: number) {
  // --- STATE MANAGEMENT ---
  const [albums, setAlbums] = useState<Album[]>([]);
  const [top10Albums, setTop10Albums] = useState<Album[]>([]);
  const [newReleases, setNewReleases] = useState<Album[]>([]);
  const [recommendations, setRecommendations] = useState<Album[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Debounce dla pola wyszukiwania - kluczowe dla wydajności
  const debouncedSearch = useDebounced(filters.search || '', 400);

  // --- DATA FETCHING ---

  useEffect(() => {
    const fetchUserAndInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const [top10, releases, recs] = await Promise.all([
        api.fetchTop10Albums(),
        api.fetchNewReleases(),
        user ? api.fetchRecommendations(user.id) : Promise.resolve([])
      ]);
      setTop10Albums(top10);
      setNewReleases(releases);
      setRecommendations(recs);
    };

    fetchUserAndInitialData();
  }, []); // Ten efekt uruchamia się tylko raz


  // Funkcja do pobierania albumów - teraz zależy od wartości prymitywnych
  const fetchFilteredAlbums = useCallback(async () => {
    setLoading(true);
    const apiFilters = {
        ...filters,
        debouncedSearch,
        limit,
    };
    const result = await api.fetchAlbums(apiFilters);
    setAlbums(result.albums);
    setTotal(result.total);
    setLoading(false);
  }, [
    // KLUCZOWA ZMIANA: Zależymy od wartości prymitywnych, a nie od obiektu `filters`
    filters.page,
    filters.genreFilter,
    filters.yearFrom,
    filters.yearTo,
    filters.artistFilter,
    filters.ratingMin,
    filters.sortBy,
    debouncedSearch, // Zależymy od wartości po debouncingu
    limit
  ]);


  useEffect(() => {
    fetchFilteredAlbums();
  }, [fetchFilteredAlbums]);


  // --- DATA REFRESH & HANDLERS ---
  const refreshDynamicData = useCallback(async () => {
    const [top10, filteredResult] = await Promise.all([
        api.fetchTop10Albums(),
        api.fetchAlbums({ ...filters, debouncedSearch, limit })
    ]);
    
    setTop10Albums(top10);
    setAlbums(filteredResult.albums);
    setTotal(filteredResult.total);
  }, [filters, debouncedSearch, limit]);


  const handleToggleFavorite = useCallback(async (albumId: string | number, isCurrentlyFavorite: boolean) => {
    if (!currentUser) return;
    await api.toggleFavorite(albumId, isCurrentlyFavorite, currentUser.id);
    await refreshDynamicData();
  }, [currentUser, refreshDynamicData]);


  const handleUpsertRating = useCallback(async (albumId: string | number, ratingValue: number) => {
    if (!currentUser) return;
    await api.upsertRating(albumId, ratingValue, currentUser.id);
    await refreshDynamicData();
  }, [currentUser, refreshDynamicData]);


  return {
    albums,
    top10Albums,
    newReleases,
    recommendations,
    total,
    loading,
    handleToggleFavorite,
    handleUpsertRating,
  };
}
