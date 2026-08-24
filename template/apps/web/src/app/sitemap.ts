import { ENV } from "@/config/middleware-env";
import type { MetadataRoute } from "next";

/**
 * Same origin rule as robots.ts: the middleware-safe ENV, and a fallback that
 * carries a scheme so `${BASE_URL}${route}` is always an absolute URL.
 */
const BASE_URL = (ENV.APP_URL || "https://{{name}}.com").replace(/\/+$/, "");

/**
 * Only the public routes this app actually ships:
 *  - "/"      the landing page, rendered by (main)/layout.tsx for signed-out visitors
 *  - "/help"  the public help reader, whose layout has no login gate
 *
 * Everything else the template ships is either behind authentication or auth
 * chrome, and robots.ts disallows it. The individual help articles come from
 * the database, so they are listed by /en/help/sitemap.xml instead.
 *
 * Add your own public routes here — a marketing page, pricing, legal pages —
 * as you build them.
 */
const PUBLIC_ROUTES = ["", "/help"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
