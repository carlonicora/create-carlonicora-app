import { createSerwistRoute } from "@serwist/turbopack";
import packageJson from "../../../../../../package.json";

/**
 * Serves the service worker. createSerwistRoute REQUIRES the [path] dynamic
 * segment — its GET reads params.path to pick the emitted file — so this cannot
 * live at a static app/sw.js/route.ts, and a root-level app/[path] would collide
 * with [locale]. The PUBLIC URL stays /sw.js via the rewrite in next.config.js,
 * so existing push subscriptions (keyed to the "/" scope) survive.
 *
 * The precache revision is the ROOT package.json version — the one semantic-
 * release bumps. apps/web/package.json is pinned at 1.0.0 forever, so using it
 * would freeze the /offline revision and the cached HTML would keep referencing
 * dead /_next/static chunks across deploys. Same import target as
 * features/common/components/navigations/VersionDisplay.tsx. NOT git:
 * .dockerignore excludes .git/, so `git rev-parse` fails in every production
 * image build.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision: packageJson.version }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
