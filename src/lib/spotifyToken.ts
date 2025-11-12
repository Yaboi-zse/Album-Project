// lib/spotifyToken.ts
let cachedToken: string | null = null;
let cachedExpiresAt = 0;

export async function getSpotifyAccessToken(): Promise<string> {
  const now = Date.now();

  // Jeśli mamy ważny token — użyj go ponownie
  if (cachedToken && now < cachedExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Brak SPOTIFY_CLIENT_ID lub SPOTIFY_CLIENT_SECRET w .env.local");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nie udało się uzyskać tokenu Spotify: ${errorText}`);
  }

  const data = await response.json();

  cachedToken = data.access_token;
  cachedExpiresAt = now + data.expires_in * 1000; // ważność w ms

  console.log("✅ Nowy token Spotify uzyskany (ważny przez ~1h)");
  return cachedToken!;
}
