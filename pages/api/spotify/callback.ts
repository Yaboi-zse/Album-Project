import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../src/lib/supabaseClient";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("Missing Spotify code");
  }

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Spotify token error:", tokenData);
      return res.status(400).json({ error: "Invalid token" });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Zaktualizuj profil użytkownika (musisz być zalogowany w supabase)
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (user) {
      await supabase
        .from("profiles")
        .update({
          spotify_access_token: access_token,
          spotify_refresh_token: refresh_token,
          spotify_expires_in: new Date(Date.now() + expires_in * 1000).toISOString(),
        })
        .eq("id", user.id);
    }

    res.redirect("/");
  } catch (err) {
    console.error("Spotify callback error:", err);
    res.status(500).send("Spotify auth failed");
  }
}
