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
