// src/hooks/useFilters.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

type FilterState = {
  search: string;
  genreFilter: string;
  yearFrom: string;
  yearTo: string;
  ratingMin: number | "";
  sortBy: string;
  page: number;
};

export function useFilters() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [ratingMin, setRatingMin] = useState<number | "">("");
  const [sortBy, setSortBy] = useState("title");
  const [page, setPage] = useState(1);

  // Zawsze aktualizuj stan z URL (gdy nawigacja zmienia query)
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;

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
  }, [router.query, router.isReady]);

  const applyFiltersToURL = (override: Partial<FilterState> = {}) => {
    const s: FilterState = {
      search,
      genreFilter,
      yearFrom,
      yearTo,
      ratingMin,
      sortBy,
      page,
      ...override,
    };

    const query: any = {};
    if (s.search.trim()) query.q = s.search.trim();
    if (s.genreFilter) query.genre = s.genreFilter;
    if (s.yearFrom) query.yearFrom = s.yearFrom;
    if (s.yearTo) query.yearTo = s.yearTo;
    if (s.ratingMin !== "") query.rmin = String(s.ratingMin);
    if (s.sortBy !== "title") query.sort = s.sortBy;
    if (s.page > 1) query.page = String(s.page);

    router.push({ pathname: "/", query }, undefined, { shallow: true });
  };

  const clearAllFilters = () => {
    setSearch("");
    setGenreFilter("");
    setYearFrom("");
    setYearTo("");
    setRatingMin("");
    setPage(1);
    setSortBy("title");

    router.push("/", undefined, { shallow: true });
  };

  return {
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
    applyFiltersToURL,
    clearAllFilters,
  };
}
