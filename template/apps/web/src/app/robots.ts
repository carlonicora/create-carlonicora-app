import { ENV } from "@/config/middleware-env";
import type { MetadataRoute } from "next";

/**
 * ENV comes from the middleware-safe module on purpose: this is a build-time
 * route module and has no reason to pull in `@/config/env`, which imports the
 * library and runs bootstrap() as a side effect.
 *
 * APP_URL is "" (not undefined) when NEXT_PUBLIC_ADDRESS is unset, so the
 * fallback is applied with `||`, never `??`. It carries a scheme deliberately —
 * a schemeless origin yields "{{name}}.com/sitemap.xml", which crawlers read as
 * a relative path.
 */
const BASE_URL = (ENV.APP_URL || "https://{{name}}.com").replace(/\/+$/, "");

/**
 * Everything behind authentication, plus the auth chrome itself, is kept out of
 * the index — only the landing page and the public help reader are crawlable.
 * Add your own application routes here as you build them.
 */
const PRIVATE_ROUTES = [
  "/activation",
  "/administration",
  "/auth",
  "/invitation",
  "/login",
  "/logout",
  "/notifications",
  "/oauth",
  "/offline",
  "/register",
  "/reset",
  "/roles",
  "/settings",
  "/tokenusage",
  "/users",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_ROUTES,
    },
    // Help articles are database-driven, so they are published through their own
    // generated sitemap rather than the static one.
    sitemap: [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/en/help/sitemap.xml`],
  };
}
