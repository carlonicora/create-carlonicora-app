const { createNextConfig } = require("@carlonicora/nextjs-jsonapi/next-config");
const createNextIntlPlugin = require("next-intl/plugin");
const createMDX = require("@next/mdx");

const withNextIntl = createNextIntlPlugin();
const withMDX = createMDX({ extension: /\.mdx?$/ });

module.exports = withNextIntl(
  withMDX(
    createNextConfig({
      devOrigins: ["{{name}}.test"],
      // stripe: billing; discord: avatars of Discord logins; googleMaps: the company
      // editor's address autocomplete (FormPlaceAutocomplete, Places API).
      // No turnstile (nothing renders a widget) and no googleFonts (next/font self-hosts Inter).
      services: ["stripe", "discord", "googleMaps"],
      mdx: true,
      serwist: true,
      // createSerwistRoute must live under a [path] dynamic segment, but the
      // PUBLIC worker URL must stay /sw.js — push subscriptions and the
      // registration in usePWA depend on it.
      //
      // Development gets the push-only public/sw-dev.js instead. A caching worker
      // in dev stores Turbopack dev chunks via its CacheFirst rule for
      // /_next/static/*.js; that graph is rebuilt on every HMR pass, so the worker
      // then serves a stale sibling chunk and Turbopack throws "module factory is
      // not available" during module evaluation — before React renders.
      //
      // beforeFiles, not afterFiles: it runs ahead of the filesystem, so the dev
      // destination resolves to public/sw-dev.js rather than 404ing.
      rewrites: async () => {
        const isDev = process.env.NODE_ENV !== "production";
        return {
          beforeFiles: isDev
            ? [{ source: "/sw.js", destination: "/sw-dev.js" }]
            : [
                { source: "/sw.js", destination: "/serwist/sw.js" },
                { source: "/sw.js.map", destination: "/serwist/sw.js.map" },
              ],
        };
      },
    }),
  ),
);
