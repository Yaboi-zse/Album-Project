// pages/track/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabaseClient";

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
};

type LyricLine = {
  text: string;
  words?: string[];
  isSection?: boolean;
};

export default function TrackPage() {
  const router = useRouter();
  const { id } = router.query;
  const trackId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;

  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        trackId
      );

      // 🔥 poprawny SELECT – multiline, Supabase go akceptuje
      let query = supabase
        .from("tracks")
        .select("id, album_id, title, duration, track_number, spotify_id, spotify_url, preview_url, artist_name")
; 
      // 🔥 jeśli ID jest uuid → szukaj po id
      if (isUUID) {
        query = query.eq("id", trackId);
      } else {
        // 🔥 jeśli nie jest uuid → szukaj po spotify_id
        query = query.eq("spotify_id", trackId);
      }

      const { data: local, error: localErr } = await query.maybeSingle();

      if (localErr) {
        console.warn("Supabase local lookup error:", localErr);
      }

      if (local && !cancel) {
        setTrack(local as Track);
        setLoading(false);
        return;
      }

      // ---------- remote Spotify fallback ----------
      const res = await fetch(`/api/spotify/track?track_id=${encodeURIComponent(trackId)}`);

      if (res.ok) {
        const t = await res.json();

        const normalized: Track = {
          spotify_id: t.id,
          title: t.title ?? t.name,
          duration: t.duration_ms ? Math.floor(t.duration_ms / 1000) : undefined,
          preview_url: null,
          spotify_url: t.external_urls?.spotify ?? null,
          artist_name: t.artist ?? null,
          track_number: t.track_number,
        };

        try {
          await supabase
  .from("tracks")
  .upsert(normalized, {
    onConflict: "spotify_id",
    ignoreDuplicates: false
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


// ---------- LOAD LYRICS ----------
useEffect(() => {
  if (!track || !track.title || !track.artist_name) {
    console.log("loadLyrics NOT TRIGGERED – track incomplete", track);
    return;
  }

  console.log("loadLyrics TRIGGERED WITH:", track);

  let cancel = false;

  async function load() {
    setLyricsLoading(true);

    try {
      const q = `${track.title} ${track.artist_name}`;
      console.log("FETCHING GENIUS FOR:", q);

      const res = await fetch(`/api/genius/lyrics?q=${encodeURIComponent(q)}`);
      console.log("GENIUS STATUS:", res.status);

      const text = await res.text();
      console.log("GENIUS RAW RESPONSE:", text.slice(0, 400));

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        console.warn("GENIUS JSON PARSE FAILED");
      }

      console.log("GENIUS PARSED:", payload);

      if (!payload || !payload.lyrics) {
        console.warn("NO LYRICS FOUND");
        if (!cancel) setLyricsRaw(null);
        return;
      }

        let clean = payload.lyrics
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => {
            // ❌ Contributors
            if (/^\d+\s*Contributors$/i.test(l)) return false;

            // ❌ Translations
            if (/^Translations$/i.test(l)) return false;

            // ❌ SAD!Lyrics, Lyrics, etc.
            if (/Lyrics$/i.test(l)) return false;

            // ❌ "Read More"
            if (/Read\s*More/i.test(l)) return false;

            // ❌ Opisy zaczynające się od "On “SAD!” X laments..."
            if (/^On\s*[“"']?.*?\s+(laments|talks|explains|speaks|details)/i.test(l)) return false;

            // ❌ Zlepione paragrafy (np. On“SAD!”Xlamentsabout...)
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

    const rawLines = lyricsRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sectionRegex = /^\[(.*?)\]$/;

    const parsed: LyricLine[] = rawLines.map((ln) => {
      const m = ln.match(sectionRegex);
      if (m) return { text: m[1], isSection: true };
      return { text: ln, words: ln.split(/\s+/).filter(Boolean) };
    });

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

  // debug helper
  console.log("LYRICS RAW:", lyricsRaw);

  return (
    <main
      ref={containerRef}
      className="min-h-screen px-6 py-10"
      style={{
        background:
          "radial-gradient(circle at 30% 10%, rgba(40,0,80,0.08) 0%, rgba(2,2,4,0.94) 60%)",
      }}
    >
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

      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-500 underline block mb-4">
          ← Powrót
        </Link>

        {/* Track header */}
        <div className="bg-white dark:bg-[#0b0d10] p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{track.title}</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{track.artist_name}</p>

          {track.spotify_id && (
            <iframe
              title="spotify-player"
              src={`https://open.spotify.com/embed/track/${track.spotify_id}`}
              width="100%"
              height="80"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded"
            />
          )}

          <div className="mt-3">
            <button
              onClick={enterFullscreen}
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
            >
              Pełny ekran (koncert)
            </button>
          </div>
        </div>

        {/* Lyrics */}
        <div className="bg-white dark:bg-[#0b0d10] p-4 rounded-lg shadow">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Tekst piosenki</h2>

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
