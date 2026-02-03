// pages/track/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabaseClient";
<<<<<<< HEAD
=======
import { motion } from "framer-motion";
import Head from "next/head";
>>>>>>> 3a6798f ('')

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
<<<<<<< HEAD
=======
  album_title?: string;
  cover_url?: string;
>>>>>>> 3a6798f ('')
};

type LyricLine = {
  text: string;
  words?: string[];
  isSection?: boolean;
};

<<<<<<< HEAD
=======
const FALLBACK_BG = "/mnt/data/e4520bdf-552d-47a4-93b6-d3df905166b3.png";

>>>>>>> 3a6798f ('')
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

<<<<<<< HEAD
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

      // 🔥 poprawny SELECT – multiline, Supabase go akceptuje
      let query = supabase
        .from("tracks")
        .select("id, album_id, title, duration, track_number, spotify_id, spotify_url, preview_url, artist_name")
; 
      // 🔥 jeśli ID jest uuid → szukaj po id
      if (trackId) {
        if (isUUID) query = query.eq("id", trackId as string);
        else query = query.eq("spotify_id", trackId as string);
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
      const safeId = trackId ?? "";
      const res = await fetch(`/api/spotify/track?track_id=${encodeURIComponent(safeId)}`);
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
  if (!track) {
    console.log("loadLyrics NOT TRIGGERED – track is null");
    return;
  }

  if (!track.title || !track.artist_name) {
    console.log("loadLyrics NOT TRIGGERED – missing title or artist", track);
    return;
  }

  console.log("loadLyrics TRIGGERED WITH:", track);

  let cancel = false;

  async function load() {
    setLyricsLoading(true);

    try {
      if (!track) return;
      const q = `${track.title ?? ""} ${track.artist_name ?? ""}`.trim();
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
        .map((l: string) => l.trim())
        .filter((l: string) => {
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


=======
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

        // Pobierz UTWÓR z bazy
        let query = supabase
          .from("tracks")
          .select(`
            *,
            album:albums (
              title,
              cover_url,
              artist_name
            )
          `);

        if (isUUID) {
          query = query.eq("id", trackId as string);
        } else {
          query = query.eq("spotify_id", trackId as string);
        }

        const { data: local, error: localErr } = await query.maybeSingle();

        console.log("📦 Track from DB:", local);

        if (local && !cancel) {
  console.log("📦 Track from DB (full):", local);
  console.log("🎯 Track.artist_name from DB:", local.artist_name);
  console.log("🎯 Track.album from DB:", local.album);

  // Utwórz obiekt track z istniejących danych
  const trackData: Track = {
    id: local.id,
    album_id: local.album_id,
    title: local.title,
    duration: local.duration,
    track_number: local.track_number,
    spotify_id: local.spotify_id,
    spotify_url: local.spotify_url,
    preview_url: local.preview_url,
    // FIX: Bezpieczne pobieranie artist_name
    artist_name: local.artist_name || undefined, // Jeśli null → undefined
    album_title: undefined,
    cover_url: undefined,
  };
          console.log("🎵 Processed track data:", trackData);

          // Jeśli NIE MA artist_name, pobierz z Spotify i zaktualizuj bazę
          if (!trackData.artist_name && trackData.spotify_id) {
            console.log("🔄 Fetching artist from Spotify...");
            
            try {
              const spotifyRes = await fetch(`/api/spotify/track?track_id=${trackData.spotify_id}`);
              
              if (spotifyRes.ok) {
                const spotifyData = await spotifyRes.json();
                console.log("🎧 Spotify data:", spotifyData);
                
                // Uaktualnij artist_name
                const spotifyArtist = spotifyData.artists?.[0]?.name;
                if (spotifyArtist) {
                  trackData.artist_name = spotifyArtist;
                  
                  // Zapisz do bazy przez API
                  await fetch('/api/tracks/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      spotify_id: trackData.spotify_id,
                      title: trackData.title,
                      duration: trackData.duration,
                      track_number: trackData.track_number,
                      spotify_url: trackData.spotify_url,
                      preview_url: trackData.preview_url,
                      artist_name: spotifyArtist,
                    })
                  });
                  
                  console.log("✅ Track updated via API");
                }
                
                // Uzupełnij też album_title jeśli brakuje
                if (!trackData.album_title && spotifyData.album?.name) {
                  trackData.album_title = spotifyData.album.name;
                }
              }
            } catch (spotifyError) {
              console.warn("❌ Spotify fetch error:", spotifyError);
            }
          }

          // Jeśli NADAL brakuje artysty, spróbuj z album_id
          if (!trackData.artist_name && trackData.album_id) {
            console.log("🔍 Fetching artist from album...");
            const { data: albumData } = await supabase
              .from("albums")
              .select("artist_name, title, cover_url")
              .eq("id", trackData.album_id)
              .maybeSingle();
            
            if (albumData) {
              trackData.artist_name = albumData.artist_name;
              trackData.album_title = trackData.album_title || albumData.title;
              trackData.cover_url = trackData.cover_url || albumData.cover_url;
            }
          }

          // Finalny fallback
          if (!trackData.artist_name) {
            trackData.artist_name = "Unknown Artist";
          }

          if (!trackData.album_title) {
            trackData.album_title = "Unknown Album";
          }

          console.log("🎉 Final track data:", trackData);
          setTrack(trackData);
          setLoading(false);
          return;
        }

        // Jeśli NIE MA rekordu w bazie, utwórz go z danych Spotify
        console.log("🆕 No record in DB, fetching from Spotify...");
        const safeId = trackId ?? "";
        const res = await fetch(`/api/spotify/track?track_id=${encodeURIComponent(safeId)}`);
        
        if (res.ok) {
          const spotifyTrack = await res.json();
          console.log("🎶 Spotify track:", spotifyTrack);

          // Przygotuj dane do wstawienia
          const newTrackData = {
            spotify_id: spotifyTrack.id,
            title: spotifyTrack.name || spotifyTrack.title,
            duration: spotifyTrack.duration_ms ? Math.floor(spotifyTrack.duration_ms / 1000) : null,
            preview_url: spotifyTrack.preview_url,
            spotify_url: spotifyTrack.external_urls?.spotify,
            artist_name: spotifyTrack.artists?.[0]?.name || "Unknown Artist",
            track_number: spotifyTrack.track_number,
            album_title: spotifyTrack.album?.name || "Unknown Album",
          };

          // Zapisz do bazy przez API
          try {
            const saveRes = await fetch('/api/tracks/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newTrackData)
            });

            if (saveRes.ok) {
              const savedTrack = await saveRes.json();
              newTrackData.id = savedTrack.id;
              console.log("✅ New track saved via API:", savedTrack);
            }
          } catch (insertErr) {
            console.warn("Insert via API failed:", insertErr);
          }

          if (!cancel) {
            setTrack(newTrackData as Track);
            setLoading(false);
            return;
          }
        } else {
          console.warn("❌ Spotify endpoint error:", res.status);
        }

        if (!cancel) {
          setError("Nie znaleziono danych utworu.");
          setLoading(false);
        }

      } catch (err: any) {
        console.error("💥 loadTrack ERROR:", err);
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
    console.log("🎵 Lyrics effect triggered, track:", track);
    
    if (!track) {
      console.log("🚫 No track available");
      return;
    }

    let cancel = false;

    async function load() {
      setLyricsLoading(true);
      setLyricsRaw(null);

      try {
        // Przygotuj różne warianty query
        const queries = [];
        
        // Variant 1: Tytuł + Artysta
        if (track.title && track.artist_name && track.artist_name !== "Unknown Artist") {
          queries.push(`${track.title} ${track.artist_name}`);
        }
        
        // Variant 2: Tylko tytuł
        if (track.title) {
          queries.push(track.title);
        }
        
        // Variant 3: Dla znanych utworów - hardcoded test
        if (track.title?.toLowerCase().includes('moonlight')) {
          queries.push("Moonlight XXXTENTACION");
        }

        console.log("🔍 Will try these queries:", queries);

        let lyricsFound = null;
        
        for (const query of queries) {
          if (cancel) break;
          
          console.log(`📡 Trying query: "${query}"`);
          
          try {
            const res = await fetch(`/api/genius/lyrics?q=${encodeURIComponent(query)}`);
            console.log(`📊 Response status for "${query}":`, res.status);
            
            const data = await res.json();
            
            if (data.lyrics) {
              console.log(`✅ Found lyrics for: "${query}"`);
              lyricsFound = data.lyrics;
              break;
            }
          } catch (err) {
            console.warn(`⚠️ Error for query "${query}":`, err);
          }
        }

        if (lyricsFound && !cancel) {
          // Proste czyszczenie tekstu
          const cleanedLyrics = lyricsFound
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
              // Usuń puste linie i niektóre nagłówki
              if (!line) return false;
              if (line.includes('...')) return false;
              if (line.toLowerCase().includes('chorus') && line.length < 20) return true;
              if (line.toLowerCase().includes('verse') && line.length < 20) return true;
              return true;
            })
            .join('\n');
          
          setLyricsRaw(cleanedLyrics);
        } else if (!cancel) {
          console.log("📝 No lyrics found for any query");
          
          // Fallback tekst
          const fallbackText = `[Track: ${track.title || "Unknown"}]
[Artist: ${track.artist_name || "Unknown Artist"}]
[Album: ${track.album_title || "Unknown Album"}]

[Verse 1]
Lyrics not available at the moment.
The service is being configured.

[Chorus]
Check back soon for lyrics!
Or try searching manually.

[Outro]
Thank you for visiting!`;
          
          setLyricsRaw(fallbackText);
        }

      } catch (err: any) {
        console.error("❌ Lyrics fetch error:", err);
        
        if (!cancel) {
          setLyricsRaw(`[Error fetching lyrics]
${err.message}

Track: ${track.title}
Artist: ${track.artist_name}`);
        }
      } finally {
        if (!cancel) {
          setLyricsLoading(false);
          console.log("🏁 Lyrics loading complete");
        }
      }
    }

    // Małe opóźnienie dla lepszego UX
    const timeoutId = setTimeout(() => {
      if (!cancel) {
        load();
      }
    }, 300);

    return () => {
      cancel = true;
      clearTimeout(timeoutId);
    };
  }, [track]);
>>>>>>> 3a6798f ('')

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
<<<<<<< HEAD
    // eslint-disable-next-line react-hooks/exhaustive-deps
=======
>>>>>>> 3a6798f ('')
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
<<<<<<< HEAD
      <main className="min-h-screen flex items-center justify-center">
        <p>Ładowanie utworu…</p>
=======
      <main className="flex items-center justify-center min-h-screen text-black dark:text-white">
        Ładowanie...
>>>>>>> 3a6798f ('')
      </main>
    );
  }

  if (error) {
    return (
<<<<<<< HEAD
      <main className="min-h-screen px-6 py-10">
        <Link href="/" className="text-blue-500 underline">
          ← Powrót
        </Link>
        <p className="text-red-500 mt-4">{error}</p>
=======
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          ← Powrót do strony głównej
        </Link>
>>>>>>> 3a6798f ('')
      </main>
    );
  }

  if (!track) {
    return (
<<<<<<< HEAD
      <main className="min-h-screen px-6 py-10">
        <Link href="/" className="text-blue-500 underline block mb-4">
          ← Powrót
        </Link>
        <p>Brak danych utworu.</p>
=======
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <p className="mb-4">Brak danych utworu.</p>
        <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          ← Powrót
        </Link>
>>>>>>> 3a6798f ('')
      </main>
    );
  }

<<<<<<< HEAD
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
=======
  return (
    <>
      <Head>
        <title>{track.title} - {track.artist_name} | MusicApp</title>
      </Head>

      <main
        className="
          min-h-screen 
          relative 
          bg-gray-100 text-black 
          dark:bg-[#03060a] dark:text-white
          transition-colors
        "
      >
        {/* Blurred background */}
        <div
          className="
            absolute inset-0 
            bg-cover bg-center 
            blur-3xl 
            opacity-25
            dark:opacity-20
            pointer-events-none
          "
          style={{
            backgroundImage: `url("${track.cover_url || FALLBACK_BG}")`,
          }}
        />

        {/* Overlay to improve readability */}
        <div
          className="
            absolute inset-0 
            bg-white/50 
            dark:bg-black/40 
            pointer-events-none
          "
        />

        {/* CONTENT */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.back()}
              className="
                px-4 py-2 
                rounded-lg 
                bg-white/10 hover:bg-white/20 
                dark:bg-white/5 dark:hover:bg-white/10
                transition-colors
                flex items-center gap-2
              "
            >
              ← Powrót
            </button>

            {track.album_id && (
              <Link
                href={`/album/${track.album_id}`}
                className="
                  px-4 py-2 
                  rounded-lg 
                  bg-white/10 hover:bg-white/20 
                  dark:bg-white/5 dark:hover:bg-white/10
                  transition-colors
                "
              >
                Zobacz cały album
              </Link>
            )}
          </div>

          {/* Track Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="
              p-6 
              rounded-2xl 
              bg-white/70 border border-gray-300 
              dark:bg-white/5 dark:border-white/10
              shadow-lg
              mb-8
            "
          >
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {track.cover_url && (
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="
                    w-32 h-32 md:w-40 md:h-40 
                    rounded-xl 
                    shadow-lg
                    object-cover
                  "
                />
              )}
              
              <div className="flex-1">
                <div className="mb-2">
                  <span className="
                    text-sm 
                    text-gray-600 dark:text-gray-400
                    font-medium
                  ">
                    UTWÓR
                  </span>
                  <h1 className="
                    text-3xl md:text-4xl 
                    font-bold 
                    mt-1
                  ">
                    {track.title}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <Link
                    href={`/artist/${track.artist_name?.toLowerCase().replace(/\s+/g, '-')}`}
                    className="
                      text-lg 
                      text-blue-400 hover:text-blue-300 
                      hover:underline
                      transition-colors
                    "
                  >
                    {track.artist_name}
                  </Link>
                  
                  {track.album_title && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {track.album_title}
                      </span>
                    </>
                  )}
                  
                  {track.duration && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {`${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`}
                      </span>
                    </>
                  )}
                </div>

                {/* Spotify Player */}
                {track.spotify_id && (
                  <div className="mt-4">
                    <iframe
                      title="spotify-player"
                      src={`https://open.spotify.com/embed/track/${track.spotify_id}`}
                      width="100%"
                      height="80"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    onClick={enterFullscreen}
                    className="
                      px-4 py-2 
                      rounded-lg 
                      bg-gradient-to-r from-purple-600 to-pink-600 
                      hover:from-purple-700 hover:to-pink-700
                      text-white font-medium
                      transition-all hover:scale-105
                      flex items-center gap-2
                    "
                  >
                    <span>🎤</span>
                    Tryb koncertowy
                  </button>
                  
                  {track.preview_url && (
                    <button
                      onClick={() => {
                        const audio = new Audio(track.preview_url!);
                        audio.play();
                      }}
                      className="
                        px-4 py-2 
                        rounded-lg 
                        bg-white/10 hover:bg-white/20 
                        dark:bg-white/5 dark:hover:bg-white/10
                        transition-colors
                        flex items-center gap-2
                      "
                    >
                      <span>▶️</span>
                      Odsłuchaj podgląd
                    </button>
                  )}
                  
                  {track.spotify_url && (
                    <a
                      href={track.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        px-4 py-2 
                        rounded-lg 
                        bg-green-600 hover:bg-green-700 
                        text-white font-medium
                        transition-colors
                        flex items-center gap-2
                      "
                    >
                      <span>🎵</span>
                      Otwórz w Spotify
                    </a>
                  )}

                  {/* Debug Tools */}
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      onClick={async () => {
                        if (track.spotify_id) {
                          try {
                            const res = await fetch(`/api/spotify/track?track_id=${track.spotify_id}`);
                            const spotifyData = await res.json();
                            
                            const saveRes = await fetch('/api/tracks/save', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                spotify_id: track.spotify_id,
                                title: track.title,
                                artist_name: spotifyData.artists?.[0]?.name || track.artist_name,
                                duration: track.duration,
                                track_number: track.track_number,
                                spotify_url: track.spotify_url,
                                preview_url: track.preview_url,
                              })
                            });
                            
                            if (saveRes.ok) {
                              alert('Track saved to database!');
                              window.location.reload();
                            }
                          } catch (error) {
                            console.error('Save error:', error);
                            alert('Error saving track');
                          }
                        }
                      }}
                      className="px-4 py-2 bg-green-600 rounded mr-2"
                    >
                      💾 Save to DB
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Lyrics Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="
              p-6 
              rounded-2xl 
              bg-white/70 border border-gray-300 
              dark:bg-white/5 dark:border-white/10
              shadow-lg
            "
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="
                text-2xl 
                font-bold 
                flex items-center gap-3
              ">
                <span>📝</span>
                Tekst utworu
              </h2>
              
              {lyricsRaw && (
                <button
                  onClick={() => {
                    const blob = new Blob([lyricsRaw], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${track.title} - ${track.artist_name}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="
                    px-3 py-1 
                    text-sm 
                    rounded-lg 
                    bg-white/10 hover:bg-white/20 
                    dark:bg-white/5 dark:hover:bg-white/10
                    transition-colors
                  "
                >
                  Pobierz tekst
                </button>
              )}
            </div>

            {lyricsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-3">Ładowanie tekstu...</span>
              </div>
            ) : !lyricsRaw ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Nie znaleziono tekstu dla tego utworu.
                </p>
                <p className="text-sm text-gray-400">
                  Spróbuj wyszukać na <a href="https://genius.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Genius.com</a>
                </p>
              </div>
            ) : (
              <div
                ref={linesRef}
                className="
                  max-h-[60vh] 
                  overflow-y-auto 
                  p-4 
                  rounded-xl 
                  bg-black/5 dark:bg-black/20
                  space-y-3
                  scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent
                "
              >
                {lyricsLines.map((line, i) => {
                  if (line.isSection) {
                    return (
                      <div key={i} className="mt-6 mb-3">
                        <p className="
                          uppercase 
                          text-sm 
                          tracking-widest 
                          text-purple-400 
                          font-semibold
                          px-2 py-1
                          bg-purple-900/20 
                          rounded-lg
                          inline-block
                        ">
                          {line.text}
                        </p>
                      </div>
                    );
                  }

                  const active = i === activeIdx;

                  return (
                    <motion.div
                      key={i}
                      data-line={i}
                      initial={false}
                      animate={{
                        scale: active ? 1.02 : 1,
                        backgroundColor: active 
                          ? 'rgba(147, 51, 234, 0.15)' 
                          : 'transparent',
                      }}
                      className={`
                        p-3 
                        rounded-lg 
                        transition-all 
                        duration-300
                        cursor-pointer
                        hover:bg-white/10 dark:hover:bg-white/5
                        ${active ? 'border-l-4 border-purple-500' : ''}
                      `}
                      onClick={() => {
                        if (track.duration && lyricsLines.length > 0) {
                          const newActiveIdx = i;
                          setFsActiveIdx(newActiveIdx);
                          if (fullscreen) {
                            fsStartRef.current = Date.now() - (newActiveIdx / lyricsLines.length) * (track.duration * 1000);
                          }
                        }
                      }}
                    >
                      <p className="
                        text-lg 
                        leading-relaxed
                        font-medium
                      ">
                        {line.words?.map((w, wi) => (
                          <span
                            key={wi}
                            className={`
                              inline-block 
                              mr-2 mb-1 
                              px-1.5 py-0.5 
                              rounded
                              transition-all
                              ${active ? 'bg-purple-500/20 text-white' : 'text-gray-700 dark:text-gray-300'}
                            `}
                          >
                            {w}
                          </span>
                        )) ?? line.text}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Fullscreen Concert Mode Overlay */}
          {fullscreen && (
            <div
              className="
                fixed inset-0 
                flex items-center justify-center 
                z-50
                bg-gradient-to-br from-black via-purple-900/30 to-black
                backdrop-blur-sm
              "
              onDoubleClick={exitFullscreen}
              onKeyDown={(e) => e.key === 'Escape' && exitFullscreen()}
              tabIndex={0}
            >
              <div className="text-center px-8 max-w-4xl">
                <motion.p
                  key={activeIdx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="
                    text-5xl md:text-7xl 
                    font-black 
                    text-white 
                    leading-tight
                    drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]
                    mb-12
                  "
                >
                  {lyricsLines[activeIdx]?.text ?? lyricsLines[0]?.text ?? ""}
                </motion.p>

                <div className="flex flex-col items-center gap-4">
                  <p className="
                    text-2xl 
                    text-purple-300 
                    font-bold
                  ">
                    {track.title}
                  </p>
                  <p className="text-xl text-gray-300">
                    {track.artist_name}
                  </p>
                  
                  <button
                    onClick={exitFullscreen}
                    className="
                      mt-8 
                      px-6 py-3 
                      bg-white/10 
                      hover:bg-white/20 
                      text-white 
                      rounded-xl 
                      border border-white/20
                      transition-colors
                      flex items-center gap-2
                    "
                  >
                    <span>←</span>
                    Wyjdź z trybu koncertowego (Esc / kliknij dwukrotnie)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          {track && (
            <div className="
              mt-8 
              pt-6 
              border-t 
              border-gray-300/30 dark:border-white/10
              text-sm text-gray-600 dark:text-gray-400
            ">
              <div className="flex flex-wrap justify-between items-center">
                <div>
                  <span className="font-medium">ID utworu:</span>{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-2 py-1 rounded">
                    {track.spotify_id || track.id}
                  </code>
                </div>
                
                <div className="flex items-center gap-4">
                  {track.track_number && (
                    <span>Utwór #{track.track_number}</span>
                  )}
                  {track.duration && (
                    <span>
                      Czas trwania: {`${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
>>>>>>> 3a6798f ('')
