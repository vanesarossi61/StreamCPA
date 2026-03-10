import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ==========================================
  // Core
  // ==========================================
  reactStrictMode: true,
  poweredBy: false, // Remove X-Powered-By header

  // ==========================================
  // Image Optimization
  // ==========================================
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net", // Twitch profile images
      },
      {
        protocol: "https",
        hostname: "*.twimg.com", // Twitter images
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub avatars
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google avatars
      },
      {
        protocol: "https",
        hostname: "*.supabase.co", // Supabase storage
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },

  // ==========================================
  // Security Headers
  // ==========================================
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.twimg.com https://static-cdn.jtvnw.net https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com https://*.upstash.io wss://*.upstash.io https://*.supabase.co",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },

  // ==========================================
  // Redirects
  // ==========================================
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/app",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // ==========================================
  // Rewrites (tracking domain support)
  // ==========================================
  async rewrites() {
    return [
      {
        // Allow /go/SLUG as an alias for /r/SLUG
        source: "/go/:slug",
        destination: "/r/:slug",
      },
    ];
  },

  // ==========================================
  // Experimental / Performance
  // ==========================================
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Optimize package imports
    optimizePackageImports: [
      "recharts",
      "@radix-ui/react-icons",
      "lucide-react",
    ],
  },

  // ==========================================
  // Output (standalone for Docker)
  // ==========================================
  output: "standalone",

  // ==========================================
  // Webpack
  // ==========================================
  webpack: (config, { isServer }) => {
    // Fix for packages that use node: protocol
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },

  // ==========================================
  // Logging
  // ==========================================
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
