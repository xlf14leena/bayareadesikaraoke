import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for role checks (renders src/app/forbidden.tsx).
    authInterrupts: true,
    // Banner images are posted to a server action (uploads are capped at 4 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
