import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://urqvaubk6pdqpvz0.public.blob.vercel-storage.com"),
    ],
  },
};

export default nextConfig;
