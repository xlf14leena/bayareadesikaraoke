import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() for role checks (renders src/app/forbidden.tsx).
    authInterrupts: true,
    // Payment screenshots are posted to a server action (the page keeps them under 4 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
