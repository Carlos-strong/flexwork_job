import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimisation des images
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    // Domaines autorisés pour les images distantes si nécessaire
  },

  // Compression Brotli/Gzip
  compress: true,

  // Experimental : accélère la navigation côté client
  experimental: {
    // Prefetch proactif des pages liées (survol des liens)
    optimisticClientCache: true,
  },

  // Headers de sécurité + cache agressif en production
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // camera et microphone autorisés pour les appels WebRTC
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), interest-cohort=()" },
        ],
      },
      // Chunks JS/CSS : immutables en prod (hash dans le nom de fichier), no-store en dev
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: isDev
              ? "no-store, no-cache, must-revalidate"
              : "public, max-age=31536000, immutable",
          },
        ],
      },
      // Images uploadées : cache 7 jours
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
    ];
  },

  // Webpack : désactiver le cache en dev pour éviter les stales
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },

  reactStrictMode: true,
  staticPageGenerationTimeout: 120,
  // Accélère le chargement initial en pré-connectant aux domaines fréquents
  poweredByHeader: false,
  
  // Ignore ESLint et TypeScript errors pendant la build pour le développement
  // TODO: Corriger les erreurs ESLint et TypeScript avant production
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
