/**
 * Next.js Instrumentation File
 *
 * This file runs at server startup before any routes are handled.
 * It initializes the full configuration including modules, JSON:API,
 * auth, i18n, and roles before any server component runs.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Import env.ts to run full configuration:
  // - Bootstrapper.ts (registers setBootstrapper + calls bootstrap())
  // - configureJsonApi() for API client
  // - configureAuth() for token handling
  // - configureI18n() for translations
  // - configureRoles() for role IDs
  await import("@/config/env");
}
