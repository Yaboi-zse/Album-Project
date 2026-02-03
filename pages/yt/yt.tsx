// ścieżka: pages/yt/yt.tsx

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamicznie importujemy komponent kliencki z wyłączonym renderowaniem po stronie serwera (SSR)
const YouTubeClipperWithNoSSR = dynamic(
  () => import('./ytcomponents/YouTubeClipper'),
  { ssr: false, loading: () => <p className="text-center text-white">Ładowanie narzędzia...</p> }
);

export default function YtPage() {
  return (
    <main>
      <YouTubeClipperWithNoSSR />
    </main>
  );
}

