// Import env FIRST: it calls bootstrap(), which registers the modules.
//
// `_data/publicHowTo` dereferences Modules.HowTo at MODULE SCOPE, and Next
// collects a Route Handler's config (the `revalidate` export below) during the
// production build WITHOUT running instrumentation.ts — which is the only other
// thing that calls bootstrap(). Without this import the build fails with
// `Module "HowTo" not registered. No bootstrapper registered.`
import "@/config/env";
import { fetchPublicHowTos } from "../_data/publicHowTo";

export const revalidate = 3600;

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
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const articles = await fetchPublicHowTos();
  const items = articles
    .map((a) => `  <url><loc>${escapeXml(`${origin}/en/help/${a.howToType}/${a.slug}`)}</loc></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
