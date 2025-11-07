import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../src/lib/supabaseClient';
import SpotifyWebApi from 'spotify-web-api-node';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string;
  if (!code) return res.redirect('/?error=missing_code');

  const spotifyApi = new SpotifyWebApi({
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  });

  try {
    // Wymiana kodu na token
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;

    // Obliczamy datę wygaśnięcia tokena
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Pobranie aktualnego zalogowanego użytkownika Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Brak zalogowanego użytkownika', userError);
      return res.redirect('/?error=no_user');
    }

    // Zapis tokenów do Supabase
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        spotify_access_token: access_token,
        spotify_refresh_token: refresh_token,
        spotify_expires_at: expiresAt,
      })
      .eq('id', user.id);

    if (dbError) {
      console.error('❌ Błąd przy zapisie tokenów do Supabase:', dbError);
      return res.redirect('/?error=db_error');
    }

    // Sukces!
    res.redirect('/?success=1');
  } catch (err: any) {
    console.error('❌ Spotify callback error:', err.body || err);
    res.redirect('/?error=spotify_auth_failed');
  }
}
