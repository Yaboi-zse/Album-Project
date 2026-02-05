// pages/track/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabaseClient";
import { RATING_COLORS } from "../../styles/theme";

type Track = {
  id?: string;
  album_id?: string;
  title?: string;
  duration?: number;
  track_number?: number;
  spotify_id?: string;
  spotify_url?: string;
  preview_url?: string | null;
  artist_name?: string;
  artist_id?: string | null;
  artist_display_name?: string | null;
  albums?: {
    id?: string;
    title?: string;
    cover_url?: string;
    artist_id?: string;
    artist_name?: string;
    artists?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  } | null;
};

type LyricLine = {
  text: string;
  words?: string[];
  isSection?: boolean;
};

const FALLBACK_BG = "/mnt/data/e4520bdf-552d-47a4-93b6-d3df905166b3.png";

export default function TrackPage() {
  const router = useRouter();
  const { id } = router.query;
  const trackId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;

  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCounts, setRatingCounts] = useState<number[]>(Array(10).fill(0));
  const [ratingTotal, setRatingTotal] = useState(0);
  const [hoveredRatingValue, setHoveredRatingValue] = useState<number | null>(null);
  const [trackDbId, setTrackDbId] = useState<string | null>(null);

  const [lyricsRaw, setLyricsRaw] = useState<string | null>(null);
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const linesRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // fullscreen + autoscroll
  const [fullscreen, setFullscreen] = useState(false);
  const fsStartRef = useRef<number | null>(null);
  const [fsActiveIdx, setFsActiveIdx] = useState(-1);
  const loopRef = useRef<number | null>(null);

  const normalizeArtistName = (name: string) =>
    name
      .split(/,|&| feat\.| ft\.| x | with | and /i)[0]
      .trim();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
  }, []);

  const fetchRatings = async () => {
    if (!trackDbId) return;

    const { data: ratings } = await supabase
      .from("track_ratings")
      .select("rating")
      .eq("track_id", trackDbId);

    if (ratings?.length) {
      const avg = ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length;
      setAvgRating(Number(avg.toFixed(1)));
      const counts = Array(10).fill(0) as number[];
      ratings.forEach((r) => {
        const value = Number(r.rating);
        if (value >= 1 && value <= 10) counts[value - 1] += 1;
      });
      setRatingCounts(counts);
      setRatingTotal(ratings.length);
    } else {
      setAvgRating(null);
      setRatingCounts(Array(10).fill(0));
      setRatingTotal(0);
    }

    if (user?.id) {
      const { data: ur } = await supabase
        .from("track_ratings")
        .select("rating")
        .eq("track_id", trackDbId)
        .eq("user_id", user.id)
        .maybeSingle();
      setUserRating(ur?.rating ?? null);
    }
  };

  useEffect(() => {
    fetchRatings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackDbId, user?.id]);

  async function handleRating(rating: number) {
    if (!user) return alert("Musisz być zalogowany.");
    if (!trackDbId) return;

    const { data: exists } = await supabase
      .from("track_ratings")
      .select("id")
      .eq("user_id", user.id)
      .eq("track_id", trackDbId)
      .maybeSingle();

    if (exists) {
      await supabase
        .from("track_ratings")
        .update({ rating })
        .eq("id", exists.id);
    } else {
      await supabase.from("track_ratings").insert({
        rating,
        track_id: trackDbId,
        user_id: user.id,
      });
    }

    setUserRating(rating);
    fetchRatings();
  }

  // ---------- load track ----------
  useEffect(() => {
    if (!trackId) return;

    let cancel = false;

    async function loadTrack() {
      setLoading(true);
      setTrack(null);
      setError(null);

      try {
        const isUUID = /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
          trackId as string
        );

        // poprawny SELECT – multiline, Supabase go akceptuje
        let query = supabase
          .from("tracks")
          .select(
            "id, album_id, title, duration, track_number, spotify_id, spotify_url, preview_url, artist_name, albums(id, title, cover_url, artist_id, artist_name, artists(id, name))"
          );

        // jeśli ID jest uuid → szukaj po id
        if (trackId) {
          if (isUUID) query = query.eq("id", trackId as string);
          else query = query.eq("spotify_id", trackId as string);
        }
        const { data: local, error: localErr } = await query.maybeSingle();

        if (localErr) {
          console.warn("Supabase local lookup error:", localErr);
        }

        if (local && !cancel) {
          const localTrack = local as Track;
          const artistsRel = (localTrack as any).albums?.artists ?? null;
          const artistsObj = Array.isArray(artistsRel) ? artistsRel[0] : artistsRel;
          let artistId =
            (localTrack as any).albums?.artist_id ?? artistsObj?.id ?? null;
          let artistName =
            artistsObj?.name ??
            (localTrack as any).albums?.artist_name ??
            localTrack.artist_name ??
            null;

          if (artistId && !artistName) {
            const { data: artistRow } = await supabase
              .from("artists")
              .select("name")
              .eq("id", artistId)
              .maybeSingle();
            artistName = artistRow?.name ?? artistName;
          }

          if (!artistId && localTrack.album_id) {
            const { data: albumData } = await supabase
              .from("albums")
              .select("id, artist_id, artist_name, artists(id, name)")
              .eq("id", localTrack.album_id)
              .maybeSingle();

            const relArtists = (albumData as any)?.artists ?? null;
            const relArtistObj = Array.isArray(relArtists) ? relArtists[0] : relArtists;
            artistId = albumData?.artist_id ?? relArtistObj?.id ?? artistId;
            artistName = relArtistObj?.name ?? albumData?.artist_name ?? artistName;
          }

          if (!artistId && artistName) {
            const baseName = normalizeArtistName(artistName);
            const { data: artistRow } = await supabase
              .from("artists")
              .select("id, name")
              .ilike("name", baseName)
              .maybeSingle();
            artistId = artistRow?.id ?? artistId;
            artistName = artistRow?.name ?? artistName;
          }

          if (artistId && !artistName) {
            const { data: artistRow } = await supabase
              .from("artists")
              .select("name")
              .eq("id", artistId)
              .maybeSingle();
            artistName = artistRow?.name ?? artistName;
          }

          if (!artistId && !artistName && localTrack.spotify_id) {
            try {
              const res = await fetch(
                `/api/spotify/track?track_id=${encodeURIComponent(localTrack.spotify_id)}`
              );
              if (res.ok) {
                const t = await res.json();
                const primaryArtist = Array.isArray(t.artists) ? t.artists[0] : null;
                artistName = primaryArtist?.name ?? artistName;

                if (artistName) {
                  const baseName = normalizeArtistName(artistName);
                  const { data: artistRow } = await supabase
                    .from("artists")
                    .select("id, name")
                    .ilike("name", baseName)
                    .maybeSingle();
                  artistId = artistRow?.id ?? artistId;
                  artistName = artistRow?.name ?? artistName;
                }
              }
            } catch {}
          }

          setTrack({
            ...localTrack,
            artist_id: artistId,
            artist_display_name: artistName,
          });
          setLoading(false);
          return;
        }

        // ---------- remote Spotify fallback ----------
        const safeId = trackId ?? "";
        const res = await fetch(`/api/spotify/track?track_id=${encodeURIComponent(safeId)}`);
        if (res.ok) {
          const t = await res.json();

          const primaryArtist = Array.isArray(t.artists) ? t.artists[0] : null;
          const spotifyAlbumId = t.album?.id ?? null;
          let resolvedAlbumId: string | undefined = undefined;
          let resolvedArtistId: string | null = null;
          let resolvedArtistName: string | null = null;

          if (spotifyAlbumId) {
            const { data: albumRow } = await supabase
              .from("albums")
              .select("id, artist_id, artist_name, artists(id, name), spotify_id")
              .eq("spotify_id", spotifyAlbumId)
              .maybeSingle();

            const relArtists = (albumRow as any)?.artists ?? null;
            const relArtistObj = Array.isArray(relArtists) ? relArtists[0] : relArtists;

            resolvedAlbumId = albumRow?.id;
            resolvedArtistId = albumRow?.artist_id ?? relArtistObj?.id ?? null;
            resolvedArtistName = relArtistObj?.name ?? albumRow?.artist_name ?? null;
          }

          if (!resolvedArtistId && primaryArtist?.name) {
            const baseName = normalizeArtistName(primaryArtist.name);
            const { data: artistRow } = await supabase
              .from("artists")
              .select("id, name")
              .ilike("name", baseName)
              .maybeSingle();
            resolvedArtistId = artistRow?.id ?? resolvedArtistId;
            resolvedArtistName = artistRow?.name ?? resolvedArtistName;
          }

          if (resolvedArtistId && !resolvedArtistName) {
            const { data: artistRow } = await supabase
              .from("artists")
              .select("name")
              .eq("id", resolvedArtistId)
              .maybeSingle();
            resolvedArtistName = artistRow?.name ?? resolvedArtistName;
          }

          const normalized: Track = {
            spotify_id: t.id,
            title: t.title ?? t.name,
            duration: t.duration_ms ? Math.floor(t.duration_ms / 1000) : undefined,
            preview_url: null,
            spotify_url: t.external_urls?.spotify ?? null,
            artist_name: primaryArtist?.name ?? null,
            track_number: t.track_number,
            album_id: resolvedAlbumId,
            artist_id: resolvedArtistId,
            artist_display_name: resolvedArtistName ?? primaryArtist?.name ?? null,
          };

          try {
            await supabase
              .from("tracks")
              .upsert(normalized, {
                onConflict: "spotify_id",
                ignoreDuplicates: false,
              })
              .select();
          } catch (upsertErr) {
            console.warn("Upsert failed:", upsertErr);
          }

          if (!cancel) {
            setTrack(normalized);
            setLoading(false);
            return;
          }
        } else {
          console.warn("Spotify endpoint returned:", res.status);
        }

        if (!cancel) {
          setError("Nie znaleziono danych utworu (lokalnie ani w Spotify).");
          setLoading(false);
        }
      } catch (err: any) {
        console.error("loadTrack ERROR:", err);
        if (!cancel) {
          setError(err?.message ?? "Błąd podczas ładowania utworu");
          setLoading(false);
        }
      }
    }

    loadTrack();
    return () => {
      cancel = true;
    };
  }, [trackId]);

  // ---------- resolve track db id ----------
  useEffect(() => {
    if (!track) return;
    const localId = (track as any).id ?? null;
    if (localId) {
      setTrackDbId(localId);
      return;
    }
    if (!track.spotify_id) return;

    let cancel = false;
    supabase
      .from("tracks")
      .select("id")
      .eq("spotify_id", track.spotify_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setTrackDbId(data?.id ?? null);
      });

    return () => {
      cancel = true;
    };
  }, [track]);

  // ---------- LOAD LYRICS ----------
  useEffect(() => {
    if (!track) return;
    if (!track.title || (!track.artist_display_name && !track.artist_name)) return;

    let cancel = false;

    async function load() {
      setLyricsLoading(true);

      try {
        if (!track) return;
        const titleParam = track.title ?? "";
        const artistParam = normalizeArtistName(track.artist_display_name ?? track.artist_name ?? "");

        const res = await fetch(
          `/api/genius/lyrics?title=${encodeURIComponent(titleParam)}&artist=${encodeURIComponent(artistParam)}`
        );
        const text = await res.text();

        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch {
          console.warn("GENIUS JSON PARSE FAILED");
        }

        if (!payload || !payload.lyrics) {
          if (!cancel) setLyricsRaw(null);
          return;
        }

        let clean = payload.lyrics
          .split(/\r?\n/)
          .map((l: string) => l.trim())
          .filter((l: string) => {
            if (/^\d+\s*Contributors$/i.test(l)) return false;
            if (/^Translations$/i.test(l)) return false;
            if (/Lyrics$/i.test(l)) return false;
            if (/Read\s*More/i.test(l)) return false;
            if (/^On\s*[“"']?.*?\s+(laments|talks|explains|speaks|details)/i.test(l)) return false;
            if (/^On[“"'A-Za-z0-9]+/i.test(l)) return false;
            return l.length > 0;
          })
          .join("\n");

        if (!cancel) setLyricsRaw(clean);
      } catch (err) {
        console.error("GENIUS FETCH ERROR:", err);
        if (!cancel) setLyricsRaw(null);
      } finally {
        if (!cancel) setLyricsLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, [track]);

  // ---------- parse lyrics ----------
  useEffect(() => {
    if (!lyricsRaw) {
      setLyricsLines([]);
      return;
    }

    const rawLines = lyricsRaw.split(/\r?\n/).map((l) => l.trim());
    const sectionRegex = /^\[(.*?)\]$/;
    const altSectionRegex = /^(chorus|verse|bridge|refren|zwrotka|vers|intro|outro|pre-chorus|post-chorus)(\s*\d+)?\s*:?\s*$/i;

    const normalizeSection = (label: string) => {
      const lower = label.toLowerCase();
      const numberMatch = lower.match(/\d+/);
      const suffix = numberMatch ? ` ${numberMatch[0]}` : "";

      if (lower.includes("chorus") || lower.includes("ref")) return `[refren${suffix}]`;
      if (lower.includes("verse") || lower.includes("zwrotka") || lower.includes("vers")) {
        return `[wers${suffix}]`;
      }
      if (lower.includes("bridge")) return `[bridge${suffix}]`;
      if (lower.includes("pre-chorus")) return `[pre-refren${suffix}]`;
      if (lower.includes("post-chorus")) return `[post-refren${suffix}]`;
      if (lower.includes("intro")) return `[intro${suffix}]`;
      if (lower.includes("outro")) return `[outro${suffix}]`;
      return `[${label}]`;
    };

    const parsed: LyricLine[] = rawLines
      .map((ln) => {
        if (!ln) return null;
        const m = ln.match(sectionRegex);
        if (m) return { text: normalizeSection(m[1]), isSection: true };
        const alt = ln.match(altSectionRegex);
        if (alt) {
          const label = `${alt[1]}${alt[2] ?? ""}`;
          return { text: normalizeSection(label), isSection: true };
        }
        return { text: ln, words: ln.split(/\s+/).filter(Boolean) };
      })
      .filter(Boolean) as LyricLine[];

    setLyricsLines(parsed);
  }, [lyricsRaw]);

  // ---------- FULLSCREEN CHANGE LISTENER ----------
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setFullscreen(isFs);

      if (isFs) {
        fsStartRef.current = Date.now();
        if (fsActiveIdx < 0) setFsActiveIdx(0);
        startFullscreenLoop();
      } else {
        stopFullscreenLoop();
        setFsActiveIdx(-1);
        fsStartRef.current = null;
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricsLines, track?.duration]);

  // ---------- FULLSCREEN AUTO-SCROLL LOOP ----------
  function startFullscreenLoop() {
    stopFullscreenLoop();

    const loop = () => {
      const dur = track?.duration ?? 0;
      if (!dur || lyricsLines.length === 0) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }

      const start = fsStartRef.current ?? Date.now();
      const elapsed = (Date.now() - start) / 1000;
      const ratio = Math.min(1, elapsed / dur);

      const idx = Math.min(lyricsLines.length - 1, Math.floor(ratio * lyricsLines.length));
      setFsActiveIdx(idx);

      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }

  function stopFullscreenLoop() {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
  }

  // ---------- enter / exit fullscreen ----------
  async function enterFullscreen() {
    try {
      if (containerRef.current) await containerRef.current.requestFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {}
  }

  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }

  // ---------- active index in normal mode ----------
  const activeIdx = fullscreen ? fsActiveIdx : -1;

  // ---------- auto-scroll lines ----------
  useEffect(() => {
    if (!fullscreen) return;
    if (!linesRef.current) return;
    if (activeIdx < 0) return;

    const el = linesRef.current.querySelector(`[data-line="${activeIdx}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, fullscreen]);

  // ---------- render ----------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Ładowanie utworu…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-10">
        <Link href="/" className="text-blue-500 underline">
          ← Powrót
        </Link>
        <p className="text-red-500 mt-4">{error}</p>
      </main>
    );
  }

  if (!track) {
    return (
      <main className="min-h-screen px-6 py-10">
        <Link href="/" className="text-blue-500 underline block mb-4">
          ← Powrót
        </Link>
        <p>Brak danych utworu.</p>
      </main>
    );
  }

  const albumCover = track.albums?.cover_url || FALLBACK_BG;

  return (
    <main
      ref={containerRef}
      className="min-h-screen relative bg-gray-100 text-black dark:bg-[#03060a] dark:text-white"
    >
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 dark:opacity-20 pointer-events-none"
        style={{ backgroundImage: `url(\"${albumCover}\")` }}
      />
      <div className="absolute inset-0 bg-white/50 dark:bg-black/40 pointer-events-none" />

      {/* === FULLSCREEN CONCERT MODE === */}
      {fullscreen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            background:
              "radial-gradient(circle, rgba(40,0,80,0.32) 0%, rgba(0,0,0,0.98) 70%)",
          }}
          onDoubleClick={exitFullscreen}
        >
          <div className="text-center px-6">
            <p
              className="text-5xl sm:text-7xl font-extrabold text-white drop-shadow-2xl"
              style={{
                textShadow: "0 0 40px rgba(150,60,255,0.45)",
              }}
            >
              {lyricsLines[activeIdx]?.text ?? lyricsLines[0]?.text ?? ""}
            </p>

            <button
              onClick={exitFullscreen}
              className="mt-10 px-4 py-2 bg-white/10 text-white rounded-md border border-white/20"
            >
              Wyjdź z pełnego ekranu (Esc)
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        <Link href="/" className="mb-6 inline-block px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          ← Powrót
        </Link>

        <div className="mb-10 grid grid-cols-1 gap-6">
          <div className="w-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-3xl font-bold">{track.title}</h1>
                  <span className="text-sm text-gray-600 dark:text-gray-300">•</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Utwór</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {track.artist_id ? (
                    <Link
                      href={`/artist/${track.artist_id}`}
                      className="text-blue-300 hover:underline"
                    >
                      {track.artist_display_name ?? "Artysta"}
                    </Link>
                  ) : track.artist_display_name ? (
                    <span>{track.artist_display_name}</span>
                  ) : (
                    "Nieznany artysta"
                  )}
                </p>
                {track.album_id && track.albums?.title && (
                  <Link
                    href={`/album/${track.album_id}`}
                    className="mt-2 inline-block text-sm text-blue-300 hover:underline"
                  >
                    Album: {track.albums.title}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <aside className="h-full">
              <div className="h-full p-4 rounded-xl bg-white/60 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10 relative">
                <h4 className="font-semibold mb-3">Statystyki</h4>
                <div className="absolute top-4 right-4 flex items-end gap-1 h-10 group">
                  {ratingCounts.map((count, idx) => {
                    const max = Math.max(1, ...ratingCounts);
                    const height = Math.max(2, Math.round((count / max) * 32));
                    return (
                      <div
                        key={`rating-bar-${idx}`}
                        style={{
                          height: `${height}px`,
                          background: RATING_COLORS[idx + 1],
                          opacity: count ? 1 : 0.3,
                        }}
                        className="w-2 rounded-sm transition-transform duration-150 group-hover:scale-y-110 group-hover:brightness-110"
                      />
                    );
                  })}
                  <div className="pointer-events-none absolute -top-7 right-0 rounded-md bg-black/80 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    Liczba ocen: {ratingTotal}, ocena: {avgRating ?? "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-6">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Długość</p>
                    <p className="text-lg font-bold">
                      {track.duration
                        ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Nr utworu</p>
                    <p className="text-lg font-bold">{track.track_number ?? "—"}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm mb-2">Twoja ocena:</p>
                  <div
                    className="grid grid-cols-10 gap-1.5 w-full"
                    onMouseLeave={() => setHoveredRatingValue(null)}
                  >
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const value = idx + 1;
                      const isActive = userRating === value;
                      const isHighlighted =
                        hoveredRatingValue !== null && value <= hoveredRatingValue;

                      return (
                        <button
                          key={value}
                          type="button"
                          onMouseEnter={() => setHoveredRatingValue(value)}
                          onClick={() => handleRating(value)}
                          style={{
                            background: isActive
                              ? RATING_COLORS[value]
                              : isHighlighted
                              ? `${RATING_COLORS[value]}33`
                              : "rgba(255,255,255,0.08)",
                            border: `1px solid ${
                              isActive || isHighlighted
                                ? RATING_COLORS[value]
                                : "rgba(255,255,255,0.2)"
                            }`,
                            transform: isActive
                              ? "scale(1.15)"
                              : isHighlighted
                              ? "scale(1.08)"
                              : "scale(1)",
                            boxShadow: isActive ? `0 0 12px ${RATING_COLORS[value]}` : "none",
                            transition: "all 100ms ease",
                          }}
                          className="aspect-square rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </aside>

            <section className="lg:col-span-2 h-full">
              <div className="h-full p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
                <h3 className="text-xl font-semibold mb-4">Odtwarzacz</h3>
                {track.spotify_id ? (
                  <iframe
                    title="spotify-player"
                    src={`https://open.spotify.com/embed/track/${track.spotify_id}`}
                    width="100%"
                    height="80"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded"
                  />
                ) : (
                  <p className="text-sm text-gray-500">Brak odtwarzacza Spotify.</p>
                )}

                <div className="mt-4">
                  <button
                    onClick={enterFullscreen}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                  >
                    Pełny ekran (koncert)
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/70 border border-gray-300 shadow-lg dark:bg-white/5 dark:border-white/10">
          <h2 className="text-xl font-semibold mb-4">Tekst piosenki</h2>

          {lyricsLoading ? (
            <p className="text-gray-400 text-sm">Ładowanie…</p>
          ) : !lyricsRaw ? (
            <p className="text-gray-400 text-sm">Nie znaleziono tekstu.</p>
          ) : (
            <div ref={linesRef} className="max-h-[65vh] overflow-auto p-2 rounded space-y-2">
              {lyricsLines.map((line, i) => {
                if (line.isSection) {
                  return (
                    <div key={i} className="mt-6 mb-2">
                      <p className="uppercase text-xs tracking-widest text-purple-400 font-semibold">
                        {line.text}
                      </p>
                      <div className="w-full h-px bg-gray-700 mt-1"></div>
                    </div>
                  );
                }

                const active = i === activeIdx;

                return (
                  <div
                    key={i}
                    data-line={i}
                    className={`p-3 rounded transition-all duration-200 ${
                      active
                        ? "scale-[1.05] bg-purple-900/20 border-l-4 border-purple-500 text-white"
                        : "hover:bg-gray-100 dark:hover:bg-[#081014] text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">
                      {line.words?.map((w, wi) => (
                        <span key={wi} className="inline-block mr-1 mb-0.5 px-1 py-0.5">
                          {w}
                        </span>
                      )) ?? line.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
