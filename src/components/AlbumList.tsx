import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  username: string;
  avatar_url?: string;
}

export default function UserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData);
    };

    fetchProfile();
  }, []);

  if (!profile) return <p>Ładowanie użytkownika...</p>;

  return (
    <div className="flex items-center gap-4 p-4">
      {profile.avatar_url && <img src={profile.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full" />}
      <span className="font-bold">{profile.username}</span>
    </div>
  );
}
