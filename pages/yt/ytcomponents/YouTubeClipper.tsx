// ścieżka: components/YouTubeClipper.tsx

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// --- Deklaracje typów i interfejsów ---
type Player = YT.Player & {
    getPlayerState: () => number;
    getCurrentTime: () => number;
    getDuration: () => number;
};

declare global {
  interface Window {
    YT: any; // Używamy 'any' dla uproszczenia, by uniknąć konfliktów typów z globalnym YT
    onYouTubeIframeAPIReady?: () => void;
  }
}

// --- Funkcje pomocnicze (bez zmian) ---
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function parseYouTubeId(input: string): string | null { try { const t = input.trim(); if (!t) return null; if (!t.includes("/") && !t.includes("=")) return t; const u = new URL(t), h = u.hostname.replace(/^www\./, ""); if (h === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] || null; if (h.endsWith("youtube.com")) { const v = u.searchParams.get("v"); if (v) return v; const p = u.pathname.split("/").filter(Boolean), s = p.indexOf("shorts"); if (s >= 0 && p[s + 1]) return p[s + 1]; const e = p.indexOf("embed"); if (e >= 0 && p[e + 1]) return p[e + 1]; } return null; } catch { return null; } }
function formatTime(sec: number) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = (x: number) => String(x).padStart(2, "0"); if (h > 0) return `${h}:${p(m)}:${p(s)}`; return `${m}:${p(s)}`; }
function toSeconds(hms: string): number | null { const t = hms.trim(); if (!t) return null; if (/^\d+$/.test(t)) return Number(t); if (!/^\d+:\d{1,2}(:\d{1,2})?$/.test(t)) return null; const p = t.split(":").map(Number); if (p.some(isNaN)) return null; if (p.length === 2) { const [m, s] = p; return m * 60 + s; } const [h, m, s] = p; return h * 3600 + m * 60 + s; }
function useYouTubeApi() { const [r, s] = useState(false); useEffect(() => { if (window.YT?.Player) { s(true); return; } if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) { const t = document.createElement("script"); t.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(t); } const p = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { p?.(); s(true); }; return () => { window.onYouTubeIframeAPIReady = p; }; }, []); return r; }
function buildLinks(videoId: string, start: number, end: number) { const s = Math.floor(start), e = Math.floor(end); return { watch: `https://www.youtube.com/watch?v=${videoId}&t=${s}s`, embed: `https://www.youtube.com/embed/${videoId}?start=${s}&end=${e}&autoplay=0&rel=0` }; }

// --- Główny komponent ---
export default function YouTubeClipper() {
  const ytReady = useYouTubeApi();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const pollRef = useRef<number | null>(null);
  const [urlOrId, setUrlOrId] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const videoId = useMemo(() => parseYouTubeId(urlOrId), [urlOrId]);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(20);
  const [loop, setLoop] = useState(true);
  const [startText, setStartText] = useState("0");
  const [endText, setEndText] = useState("20");
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Ładowanie narzędzia wideo...");
  const links = useMemo(() => videoId ? buildLinks(videoId, start, end) : null, [videoId, start, end]);

  useEffect(() => { const load = async () => { const f = new FFmpeg(); f.on("progress", ({ progress }) => setProgress(Math.round(progress * 100))); const u = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"; await f.load({ coreURL: await toBlobURL(`${u}/ffmpeg-core.js`, "text/javascript"), wasmURL: await toBlobURL(`${u}/ffmpeg-core.wasm`, "application/wasm") }); ffmpegRef.current = f; setIsFfmpegLoaded(true); setMessage("Gotowy. Wklej link, ustaw klip i pobierz."); }; load(); }, []);
  useEffect(() => { if (!ytReady || !mountRef.current || !videoId) return; playerRef.current?.destroy(); const p: Player = new window.YT.Player(mountRef.current, { videoId, playerVars: { rel: 0, playsinline: 1 }, events: { onReady: () => { const d = p.getDuration?.() ?? 0; setDuration(d); const e = d > 0 ? clamp(20, 0, d) : 20; setEnd(e); setStart(0); setStartText("0"); setEndText(String(e)); } } }); playerRef.current = p; return () => { playerRef.current?.destroy(); }; }, [ytReady, videoId]);
  
  // ZMIANA: Zastosowano bezpieczne wywołania (`?.`)
  useEffect(() => {
    const tick = () => {
      const p = playerRef.current;
      // Sprawdzamy, czy 'p' istnieje i czy ma wymaganą funkcję.
      if (!p || typeof p.getCurrentTime !== 'function') return;

      const t = p.getCurrentTime?.() ?? 0;
      setCurrent(t);
      
      if (loop && p.getPlayerState?.() === 1) {
        const s = Math.min(start, end);
        const e = Math.max(start, end);
        if (e > 0 && t >= e - 0.1) {
          p.seekTo?.(s, true);
        }
      }
    };
    pollRef.current = window.setInterval(tick, 200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [start, end, loop]);

  const applyTime = (text: string, setter: (val: number) => void, mode: 'start' | 'end') => { const v = toSeconds(text); if (v == null) return; let final = v; if (duration > 0) { if (mode === 'start') final = clamp(v, 0, end > 0 ? end - 1 : duration); else final = clamp(v, start > 0 ? start + 1 : 0, duration); } setter(final); };
  
  // ZMIANA: Zastosowano bezpieczne wywołania (`?.`)
  const playSegment = () => { playerRef.current?.seekTo?.(Math.min(start, end), true); playerRef.current?.playVideo?.(); };
  const copy = (text: string) => navigator.clipboard.writeText(text);

  async function handleDownload() {
    const ffmpeg = ffmpegRef.current;
    if (!videoId || !ffmpeg) { setMessage(videoId ? "FFmpeg nie jest gotowy." : "Podaj link do filmu."); return; }
    const s = Math.min(start, end), e = Math.max(start, end);
    if (e - s <= 0) { setMessage("Klip musi mieć dodatnią długość."); return; }
    setIsProcessing(true); setProgress(0);
    try {
      setMessage("1/4: Pobieranie linku...");
      const res = await fetch(`http://localhost:4000/download?videoId=${videoId}`);
      if (!res.ok) throw new Error(`Proxy: ${await res.text()}`);
      const { url } = await res.json();
      setMessage("2/4: Ładowanie pliku...");
      await ffmpeg.writeFile("i.mp4", await fetchFile(url));
      setMessage("3/4: Wycinanie klipu...");
      await ffmpeg.exec(["-i", "i.mp4", "-ss", String(s), "-to", String(e), "-c", "copy", "o.mp4"]);
      setMessage("4/4: Przygotowanie pliku...");
      const data = await ffmpeg.readFile("o.mp4");
      const blobUrl = await toBlobURL(new Uint8Array(data as ArrayBuffer), "video/mp4");
      const a = document.createElement("a");
      a.href = blobUrl; a.download = `${videoId}_${Math.floor(s)}-${Math.floor(e)}.mp4`;
      a.click(); window.URL.revokeObjectURL(blobUrl);
      setMessage("Pobieranie zakończone!");
    } catch (err: any) { console.error(err); setMessage(`Błąd: ${err.message}`); } finally { setIsProcessing(false); }
  }

  const s = Math.min(start, end), e = Math.max(start, end);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">YouTube Clip Selector</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-300">
            Wklej link do filmu, ustaw <span className="font-medium text-zinc-100">Start</span> i <span className="font-medium text-zinc-100">End</span>, a następnie pobierz klip.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* --- LEWA KOLUMNA: ODTWARZACZ I KONTROLKI --- */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm">
            <label className="text-xs font-medium text-zinc-300">Link lub ID filmu</label>
            <div className="mt-2"><input className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-600 focus:border-zinc-600" value={urlOrId} onChange={(e) => setUrlOrId(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></div>
            <div className="mt-2 text-xs text-zinc-400">{videoId ? <span>Wykryte ID: <span className="font-mono text-zinc-200">{videoId}</span></span> : <span className="text-amber-300">Nie rozpoznano ID filmu.</span>}</div>
            <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-black"><div ref={mountRef} className="h-full w-full" /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={playSegment} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200" disabled={!videoId}>▶ Odtwórz fragment</button>
              <button onClick={() => playerRef.current?.pauseVideo?.()} className="rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-sm hover:border-zinc-500">⏸ Pauza</button>
              <label className="ml-auto inline-flex items-center gap-2 text-sm text-zinc-200"><input type="checkbox" className="h-4 w-4 rounded border-zinc-700 bg-zinc-950" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400"><span>Czas: <span className="font-mono text-zinc-200">{formatTime(current)}</span></span><span>Długość: <span className="font-mono text-zinc-200">{duration ? formatTime(duration) : "—"}</span></span></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between"><label className="text-xs font-medium text-zinc-300">Start</label><span className="text-xs font-mono text-zinc-300">{formatTime(s)}</span></div>
                  <input type="range" min={0} max={Math.floor(duration || 0)} value={Math.floor(start)} onChange={(e) => setStart(Number(e.target.value))} className="mt-2 w-full" disabled={!videoId} />
                  <div className="mt-2 flex gap-2">
                    <input className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm font-mono" value={startText} onChange={(e) => setStartText(e.target.value)} onBlur={() => applyTime(startText, setStart, 'start')} placeholder="np. 1:23" />
                    <button onClick={() => applyTime(startText, setStart, 'start')} className="rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-sm">Ustaw</button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between"><label className="text-xs font-medium text-zinc-300">End</label><span className="text-xs font-mono text-zinc-300">{formatTime(e)}</span></div>
                  <input type="range" min={0} max={Math.floor(duration || 0)} value={Math.floor(end)} onChange={(e) => setEnd(Number(e.target.value))} className="mt-2 w-full" disabled={!videoId} />
                  <div className="mt-2 flex gap-2">
                    <input className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm font-mono" value={endText} onChange={(e) => setEndText(e.target.value)} onBlur={() => applyTime(endText, setEnd, 'end')} placeholder="np. 2:10" />
                    <button onClick={() => applyTime(endText, setEnd, 'end')} className="rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-sm">Ustaw</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2"><div className="text-xs text-zinc-300">Długość klipu: <span className="font-mono text-zinc-100">{formatTime(e - s)}</span></div></div>
            </div>
          </section>

          {/* --- PRAWA KOLUMNA: WYNIKI I POBIERANIE --- */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Wynik</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-xs font-medium text-zinc-300">YouTube watch</div><div className="mt-1 break-all font-mono text-sm text-zinc-100">{links ? links.watch : "—"}</div></div>
                  <button onClick={() => links && copy(links.watch)} className="shrink-0 rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40" disabled={!links}>Kopiuj</button>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs font-medium text-zinc-300">Podgląd embed</div>
                <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-black">{links ? <iframe className="h-full w-full" src={links.embed} title="YouTube embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">Wklej link/ID.</div>}</div>
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
                <h3 className="text-base font-semibold text-zinc-100">Pobierz klip</h3>
                <p className="mt-1 text-sm text-zinc-400">Użyj przycisku, aby wyciąć i pobrać wybrany fragment jako plik MP4.</p>
                <div className="mt-4">
                  <button onClick={handleDownload} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800/50 disabled:opacity-60" disabled={!videoId || !isFfmpegLoaded || isProcessing}>{isProcessing ? `Przetwarzanie... ${progress}%` : "Pobierz klip"}</button>
                  <div className="mt-3 text-center text-xs text-zinc-400">{message}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
