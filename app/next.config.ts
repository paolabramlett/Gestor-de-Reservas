import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        // El navegador solo revisa si sw.js cambió cuando lo vuelve a pedir.
        // Sin este header puede tardar hasta 24h en notar una versión nueva
        // (o quedarse con una vieja rota indefinidamente en algunos casos).
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
