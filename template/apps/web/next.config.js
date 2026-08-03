const path = require("path");

const createNextIntlPlugin = require("next-intl/plugin");
const createMDX = require("@next/mdx");

// Try pointing to package's request config (requires next-intl to resolve module specifiers)
// Note: If this doesn't work, we'll need a minimal ./src/i18n/request.ts file
const withNextIntl = createNextIntlPlugin();

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const imageSources = process.env.IMAGE_SOURCES
  ? process.env.IMAGE_SOURCES.split(",").map((url) => {
      const { hostname, protocol, port } = new URL(url.trim());
      return {
        protocol: protocol.replace(":", ""),
        hostname,
        port: port || undefined,
      };
    })
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    useCache: true,
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  allowedDevOrigins: ['{{name}}.test'],
  pageExtensions: ["ts", "tsx", "mdx"],
  images: {
    minimumCacheTTL: 60,
    remotePatterns: imageSources,
    dangerouslyAllowLocalIP: true,
  },
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
    NEXT_PUBLIC_ADDRESS: process.env.NEXT_PUBLIC_ADDRESS ?? "",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  },
  webpack: (config, { isServer }) => {
    // Force single Yjs instance to prevent "Yjs was already imported" error
    // Note: This only works with webpack builds (production). For Turbopack (dev),
    // we rely on pnpm.overrides in root package.json
    config.resolve.alias["yjs"] = path.resolve(__dirname, "node_modules/yjs");
    return config;
  },
  async headers() {
    // Build CSP directives
    // Note: 'unsafe-inline' and 'unsafe-eval' needed for Next.js dev mode and some runtime features
    // In production, consider using nonces for stricter CSP
    const cspDirectives = [
      "default-src 'self'",
      // Scripts: self, Stripe, Google Maps, Turnstile, and unsafe-inline/eval for Next.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://challenges.cloudflare.com",
      // Styles: self and unsafe-inline for styled-components/emotion
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self, data URIs, blobs, Discord avatars, and configured image sources
      "img-src 'self' data: blob: https://*.stripe.com https://maps.googleapis.com https://maps.gstatic.com https://cdn.discordapp.com " +
        (process.env.IMAGE_SOURCES
          ? process.env.IMAGE_SOURCES.split(",")
              .map((s) => s.trim())
              .join(" ")
          : ""),
      // Fonts: self and Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Connect: self, API (http + ws for socket.io), Stripe, Google, Turnstile, and storage (for uploads)
      "connect-src 'self' https://api.stripe.com https://maps.googleapis.com https://challenges.cloudflare.com " +
        (process.env.NEXT_PUBLIC_API_URL || "") +
        " " +
        // Add WebSocket URL for socket.io (convert http->ws, https->wss)
        (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws") : "") +
        " " +
        (process.env.NEXT_PUBLIC_ADDRESS || "") +
        " " +
        (process.env.IMAGE_SOURCES
          ? process.env.IMAGE_SOURCES.split(",")
              .map((s) => s.trim())
              .join(" ")
          : ""),
      // Frames: Stripe for payment elements, Turnstile for CAPTCHA
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      // Frame ancestors: deny embedding (equivalent to X-Frame-Options: DENY)
      "frame-ancestors 'none'",
      // Form actions: only self
      "form-action 'self'",
      // Base URI: only self
      "base-uri 'self'",
      // Object sources: none (no plugins)
      "object-src 'none'",
      // Worker sources: self and blob (for Web Workers with dynamic imports)
      "worker-src 'self' blob:",
      // Upgrade insecure requests in production
      process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
    ]
      .filter(Boolean)
      .join("; ");

    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Content Security Policy - prevents XSS attacks
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
          // X-Frame-Options - prevents clickjacking (backup for older browsers)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // X-Content-Type-Options - prevents MIME sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Strict-Transport-Security - enforces HTTPS (1 year, include subdomains)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Referrer-Policy - controls referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions-Policy - restricts browser features
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(withMDX(nextConfig));
