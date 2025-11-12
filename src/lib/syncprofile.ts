// src/lib/syncProfile.ts
import { supabase } from "./supabaseClient";

export async function syncProfile() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return null;

  const { id, email, user_metadata } = user as any;
  const username = (user_metadata?.full_name as string) || (email?.split("@")[0] as string) || "Użytkownik";
  const avatar_url = user_metadata?.avatar_url || null;

  const { error } = await supabase.from("profiles").upsert({
    id,
    username,
    avatar_url,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error("Błąd synchronizacji profilu:", error);
  return { id, username, avatar_url };
}
