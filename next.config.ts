import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  output: "standalone",
  devIndicators: false,
  // Lets a phone reach `next dev` (camera scanner testing) over a tunnel or the Wi-Fi address.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.*.*"],
  partialPrefetching: true,
  experimental: {
    // Screens render from the on-device store (local-first PWA), so only
    // segments that explicitly declare `instant` are validated.
    instantInsights: { validationLevel: "manual-warning" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
