/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uxodksxuvmdfqwymjrck.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    // jeśli miałeś wcześniej turbo, zostaw — ale usuń "turbo" z tej sekcji
  },
};

export default nextConfig;
