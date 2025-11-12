// /pages/api/spotify/login.ts
import type { NextApiRequest, NextApiResponse } from "next";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!; // np. http://localhost:3000/api/spotify/callback
const SCOPES = [
  "user-read-email",
  "playlist-read-private",
  "user-library-read",
].join(" ");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
  });

  const spotifyAuthURL = `https://accounts.spotify.com/authorize?${params.toString()}`;
  return res.redirect(spotifyAuthURL);
}
