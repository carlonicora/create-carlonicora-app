// Import env FIRST: it calls bootstrap(), which registers the modules.
//
// `_data/publicHowTo` dereferences Modules.HowTo at MODULE SCOPE, and Next
// collects a Route Handler's config during the
// production build WITHOUT running instrumentation.ts — which is the only other
// thing that calls bootstrap(). Without this import the build fails with
// `Module "HowTo" not registered. No bootstrapper registered.`
import "@/config/env";
import { fetchPublicHowTos } from "@/app/[locale]/(public-help)/help/_data/publicHowTo";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { connection } from "next/server";

// It lives outside [locale] so it answers at /help/sitemap.xml: the proxy matcher
// skips any path with a dot, so nothing would rewrite that URL to a locale, and a
// route under [locale] only answers at /en/help/sitemap.xml.
//
// No `revalidate` and no "use cache" of its own: the data already comes through the
// cached path (`cache: "help"`), and a local cache scope would read the locale where
// root params throw in a Route Handler. connection() keeps it per request, never
// during `next build`, which may run with no API reachable.

// Slugs and types come from the database, so they cannot be trusted to be
// XML-safe: a bare & or < would produce a malformed sitemap.
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const articles = await fetchPublicHowTos();
  const items = articles
    .map((a) => {
      // The canonical URL: no prefix for the default locale ("as-needed").
      const pathname = getPathname({ href: `/help/${a.howToType}/${a.slug}`, locale: routing.defaultLocale });
      return `  <url><loc>${escapeXml(`${origin}${pathname}`)}</loc></url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
