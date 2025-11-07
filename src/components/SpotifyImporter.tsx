// src/components/SpotifyImporter.tsx
import React, { useState } from 'react';

type AlbumResult = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  release_date?: string;
  total_tracks?: number;
  images?: { url: string }[];
  spotify_url?: string;
  label?: string;
};

interface SpotifyImporterProps {
  onImported?: () => void;
}

const containerStyle: React.CSSProperties = {
  padding: 16,
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 6px 18px rgba(15,23,42,0.06)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 10,
  overflow: 'hidden',
  background: '#fafafa',
  border: '1px solid #e6e6e6',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 260,
};

const imgStyle: React.CSSProperties = {
  width: '100%',
  height: 160,
  objectFit: 'cover',
  background: '#e9e9e9',
};

const metaStyle: React.CSSProperties = {
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
};

export default function SpotifyImporter({ onImported }: SpotifyImporterProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AlbumResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    if (!q.trim()) {
      setMessage('Wpisz tytuł albumu lub wykonawcę.');
      return;
    }
    setMessage(null);
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Błąd serwera');
        throw new Error(txt || 'Błąd podczas wyszukiwania');
      }
      const data = (await res.json()) as AlbumResult[];
      setResults(data || []);
      if (!data || data.length === 0) setMessage('Brak wyników.');
    } catch (err: any) {
      console.error(err);
      setMessage('Błąd wyszukiwania: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const importAlbum = async (a: AlbumResult) => {
    setImportingId(a.id);
    setMessage(null);
    try {
      const payload = {
        spotifyAlbumId: a.id,
        title: a.name,
        artistName: a.artists?.[0]?.name || 'Unknown',
        coverUrl: a.images?.[0]?.url || null,
        year: a.release_date ? parseInt(a.release_date.split('-')[0]) : null,
        description: a.label || null,
      };

      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Import failed');

      setMessage('✅ Album zaimportowano');
      onImported?.();
    } catch (err: any) {
      console.error(err);
      setMessage('Błąd importu: ' + (err.message || String(err)));
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>🔎 Importuj albumy z Spotify</h3>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="np. Pink Floyd The Wall"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
        />
        <button
          onClick={search}
          disabled={loading}
          style={{
            background: '#1DB954',
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Szukam…' : 'Szukaj'}
        </button>
      </div>

      {message && (
        <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 14 }}>{message}</div>
      )}

      <div style={gridStyle}>
        {results.map((a) => (
          <div key={a.id} style={cardStyle}>
            <img
              src={a.images?.[0]?.url || '/placeholder.png'}
              alt={a.name}
              style={imgStyle}
            />
            <div style={metaStyle}>
              <div style={{ fontWeight: 700 }}>{a.name}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                {a.artists?.map((x) => x.name).join(', ')}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a href={a.spotify_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb' }}>
                  Otwórz w Spotify
                </a>
                <button
                  onClick={() => importAlbum(a)}
                  disabled={importingId === a.id}
                  style={{
                    background: importingId === a.id ? '#94a3b8' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: importingId === a.id ? 'not-allowed' : 'pointer',
                    marginLeft: 8,
                  }}
                >
                  {importingId === a.id ? 'Importuję…' : 'Importuj'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
