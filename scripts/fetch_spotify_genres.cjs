const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function getSpotifyAccessToken() {
  loadEnvLocal();

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Brak SPOTIFY_CLIENT_ID lub SPOTIFY_CLIENT_SECRET w .env.local");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`Nie udało się pobrać tokenu Spotify (${tokenRes.status}): ${txt}`);
  }

  const tokenJson = await tokenRes.json();
  return tokenJson.access_token;
}

async function main() {
  const token = await getSpotifyAccessToken();

  const res = await fetch("https://api.spotify.com/v1/recommendations/available-genre-seeds", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  console.log(data.genres);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
