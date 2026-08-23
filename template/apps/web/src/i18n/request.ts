import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { routing } from "./routing";

/**
 * Messages are STATICALLY imported and looked up in a literal map — never
 * `import(\`../../messages/${locale}.json\`)`.
 *
 * Next.js 16.2 replaced the dev server's "clear the whole require.cache" with
 * Turbopack's fine-grained module-graph invalidation (Server Fast Refresh). A
 * dynamic import whose specifier is a template literal cannot be statically
 * analysed, so after its first resolution the JSON is no longer tracked for
 * change detection: edits to messages/*.json are silently ignored and only a
 * dev-server restart picks them up. Regression from 16.1, still open upstream
 * as vercel/next.js#91768.
 *
 * A static import is analysable, so Turbopack watches the file and HMR works
 * again. Adding a locale means adding it to MESSAGES below, not reaching back
 * for a template literal.
 */
const MESSAGES = { en } satisfies Record<(typeof routing.locales)[number], unknown>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: MESSAGES[locale],
  };
});
