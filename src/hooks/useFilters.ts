<<<<<<< HEAD
// src/hooks/useFilters.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export function useFilters() {
  const router = useRouter();
  
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [ratingMin, setRatingMin] = useState<number | "">("");
  const [sortBy, setSortBy] = useState("title");
  const [page, setPage] = useState(1);

  // ODCZYTUJ URL ZAWSZE gdy się zmienia - USUŃ isInitialLoad
  useEffect(() => {
    if (router.isReady) {
      const q = router.query;
      
      console.log("🔄 useFilters updating state from URL:", q);
      
      // Zawsze aktualizuj stan z URL
      if (q.q !== undefined) setSearch(String(q.q));
      else setSearch("");
      
      if (q.genre !== undefined) setGenreFilter(String(q.genre));
      else setGenreFilter("");
      
      if (q.yearFrom !== undefined) setYearFrom(String(q.yearFrom));
      else setYearFrom("");
      
      if (q.yearTo !== undefined) setYearTo(String(q.yearTo));
      else setYearTo("");
      
      if (q.rmin !== undefined) setRatingMin(Number(q.rmin));
      else setRatingMin("");
      
      if (q.page !== undefined) setPage(Number(q.page));
      else setPage(1);
      
      if (q.sort !== undefined) setSortBy(String(q.sort));
      else setSortBy("title");
    }
  }, [router.query, router.isReady]); // USUŃ isInitialLoad

  // Zastosuj filtry do URL
  const applyFiltersToURL = () => {
    const query: any = {};

    if (search.trim()) query.q = search.trim();
    if (genreFilter) query.genre = genreFilter;
    if (yearFrom) query.yearFrom = yearFrom;
    if (yearTo) query.yearTo = yearTo;
    if (ratingMin !== "") query.rmin = String(ratingMin);
    if (sortBy !== "title") query.sort = sortBy;
    if (page > 1) query.page = String(page);

    console.log("💾 useFilters saving to URL:", query);
    router.push({ pathname: "/", query }, undefined, { shallow: true });
  };

  // Wyczyść wszystkie filtry
  const clearAllFilters = () => {
    setSearch("");
    setGenreFilter("");
    setYearFrom("");
    setYearTo("");
    setRatingMin("");
    setPage(1);
    setSortBy("title");
    
    console.log("🧹 useFilters clearing all filters");
    router.push("/", undefined, { shallow: true });
  };

  return {
    // Stany
    search,
    setSearch,
    genreFilter,
    setGenreFilter,
    yearFrom,
    setYearFrom,
    yearTo,
    setYearTo,
    ratingMin,
    setRatingMin,
    sortBy,
    setSortBy,
    page,
    setPage,
    
    // Akcje
    applyFiltersToURL,
    clearAllFilters
  };
}
=======
﻿// src/hooks/useFilters.ts

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// Helper do usuwania pustych właściwości
const cleanObject = (obj: Record<string, any>): Record<string, any> => {
  Object.keys(obj).forEach(key => (obj[key] === null || obj[key] === '') && delete obj[key]);
  return obj;
};

export function useFilters() {
  const router = useRouter();

  // Stan wewnętrzny hooka
  const [search, setSearch] = useState<string>('');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [ratingMin, setRatingMin] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('year');
  const [page, setPage] = useState<number>(1);
  const [isInitialized, setIsInitialized] = useState(false);

  const buildQuery = (override: Record<string, any> = {}) => {
    const query = cleanObject({
      search,
      genre: genreFilter,
      yearFrom,
      yearTo,
      ratingMin,
      sortBy: sortBy === 'year' ? null : sortBy,
      page: page > 1 ? page : null,
      ...override,
    });

    // Zachowaj dynamiczne parametry trasy (np. /album/[id], /username/[username])
    const preservedQuery = { ...router.query };
    delete preservedQuery.search;
    delete preservedQuery.genre;
    delete preservedQuery.yearFrom;
    delete preservedQuery.yearTo;
    delete preservedQuery.ratingMin;
    delete preservedQuery.sortBy;
    delete preservedQuery.page;

    return { ...preservedQuery, ...query };
  };

  const applyFiltersToURL = () => {
    const nextQuery = buildQuery();
    router.push({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  };

  const clearAllFilters = () => {
    setSearch('');
    setGenreFilter('');
    setYearFrom('');
    setYearTo('');
    setRatingMin('');
    setSortBy('year');
    setPage(1);

    const nextQuery = buildQuery({
      search: null,
      genre: null,
      yearFrom: null,
      yearTo: null,
      ratingMin: null,
      sortBy: null,
      page: null,
    });

    router.push({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  };

  // Efekt 1: Inicjalizacja stanu z URL
  useEffect(() => {
    if (!router.isReady) return;

    const { query } = router;
    setSearch((query.search as string) || '');
    setGenreFilter((query.genre as string) || '');
    setYearFrom((query.yearFrom as string) || '');
    setYearTo((query.yearTo as string) || '');
    setRatingMin((query.ratingMin as string) || '');
    setSortBy((query.sortBy as string) || 'year');
    setPage(Number(query.page) || 1);
    setIsInitialized(true);
  }, [router.isReady]);

  // Efekt 2: Aktualizacja URL ze stanu
  useEffect(() => {
    if (!isInitialized) return;

    const nextQuery = buildQuery();
    const currentQueryString = new URLSearchParams(router.query as any).toString();
    const newQueryString = new URLSearchParams(nextQuery as any).toString();

    if (currentQueryString !== newQueryString) {
      router.push(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true }
      );
    }
  }, [search, genreFilter, yearFrom, yearTo, ratingMin, sortBy, page, isInitialized, router]);

  // Settery z resetowaniem strony
  const createSetter = <T,>(setter: (value: T) => void) => (value: T) => {
    setPage(1);
    setter(value);
  };

  return {
    search,
    genreFilter,
    yearFrom,
    yearTo,
    ratingMin,
    sortBy,
    page,
    setSearch: createSetter(setSearch),
    setGenreFilter: createSetter(setGenreFilter),
    setYearFrom: createSetter(setYearFrom),
    setYearTo: createSetter(setYearTo),
    setRatingMin: createSetter(setRatingMin),
    setSortBy: createSetter(setSortBy),
    setPage,
    applyFiltersToURL,
    clearAllFilters,
  };
}
>>>>>>> 3a6798f ('')
