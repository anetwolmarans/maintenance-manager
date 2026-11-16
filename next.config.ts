import type { NextConfig } from "next";

// Static export: the whole app is a client-side SPA (data lives in IndexedDB /
// Firestore), so it can be hosted on GitHub Pages and wrapped in an APK.
// NEXT_PUBLIC_BASE_PATH is set for the GitHub Pages build (repo name sub-path);
// it stays empty for local dev and the Capacitor APK build.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
