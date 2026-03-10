/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==============================================
  // Core
  // ==============================================
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header

  // Standalone output for Docker deployments
  output: "standalone",

  // ==============================================
  // Image Optimization
  // ==============================================
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

  // ==============================================
  // Security Headers
  // ==============================================
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
    ];
  },

  // ==============================================
  // Redirects
  // ==============================================
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/streamer",
        permanent: false,
      },
    ];
  },

  // ==============================================
  // Webpack & Bundle Optimization
  // ==============================================
  webpack: (config, { isServer }) => {
    // Fix for packages that reference node-specific modules
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        net: false,
        tls: false,
        dns: false,
        fs: false,
      };
    }
    return config;
  },

  // ==============================================
  // Server External Packages (Next.js 14.x syntax)
  // ==============================================
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
