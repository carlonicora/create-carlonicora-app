const path = require("path");

const createNextIntlPlugin = require("next-intl/plugin");

// Try pointing to package's request config (requires next-intl to resolve module specifiers)
// Note: If this doesn't work, we'll need a minimal ./src/i18n/request.ts file
const withNextIntl = createNextIntlPlugin();

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
  pageExtensions: ["ts", "tsx"],
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
};

module.exports = withNextIntl(nextConfig);
