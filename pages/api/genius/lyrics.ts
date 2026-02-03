import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  console.log('🔍 Lyrics search for:', q);

  try {
    // Opcja 1: Spróbuj lyrics.ovh API
    const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(q)}`;
    
    console.log('📡 Trying lyrics.ovh API...');
    const response = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.lyrics) {
        console.log('✅ Found lyrics via lyrics.ovh');
        return res.status(200).json({
          lyrics: data.lyrics,
          source: 'lyrics.ovh',
          query: q,
        });
      }
    }

    // Opcja 2: Fallback dla development
    if (process.env.NODE_ENV === 'development') {
      console.log('🛠️ Using development fallback lyrics');
      const dummyLyrics = `[Track Info]
Search query: "${q}"

[Verse 1]
This is development placeholder lyrics.
Actual lyrics API needs to be properly configured.

[Chorus]
Development mode active
Configure your lyrics API

[Outro]
🎵 Test lyrics 🎵`;

      return res.status(200).json({
        lyrics: dummyLyrics,
        source: 'development-fallback',
        query: q,
      });
    }

    // Jeśli nic nie znaleziono
    console.log('❌ No lyrics found');
    return res.status(404).json({ 
      error: 'No lyrics found',
      query: q,
    });

  } catch (error: any) {
    console.error('❌ Lyrics API error:', error);
    
    const fallbackLyrics = `[Error]
Failed to fetch lyrics for: "${q}"

Error: ${error.message}`;

    return res.status(200).json({
      lyrics: fallbackLyrics,
      source: 'error-fallback',
      query: q,
      error: error.message,
    });
  }
}
