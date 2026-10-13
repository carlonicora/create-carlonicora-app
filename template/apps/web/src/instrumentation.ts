/**
 * Next.js Instrumentation File
 *
 * This file runs at server startup before any routes are handled.
 * It initializes the configuration (modules, JSON:API, auth, roles) before
 * any server component runs. i18n is configured by env.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Import instrumentation-env.ts to run the configuration:
  // - Bootstrapper.ts (registers setBootstrapper + calls bootstrap())
  // - configureJsonApi() for API client
  // - configureAuth() for token handling
  // - configureRoles() for role IDs
  // configureI18n() stays in env.ts, which every server component loads: it pulls in
  // next-intl and so `next/root-params`, which is not allowed in instrumentation.
  await import("@/config/instrumentation-env");
}
