// pages/api/spotify/token.ts
import type { NextApiRequest, NextApiResponse } from "next";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

let cachedToken: { token: string; expiresAt: number } | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // jeśli mamy ważny token w cache -> zwróć go
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5000) {
    return res.status(200).json({ access_token: cachedToken.token, expires_at: cachedToken.expiresAt });
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({ grant_type: "client_credentials" });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return res.status(500).json({ error: "Failed to get token", details: txt });
  }

  const json = await tokenRes.json();
  // json.access_token, json.expires_in (sekundy)
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return res.status(200).json({ access_token: cachedToken.token, expires_at: cachedToken.expiresAt });
}
