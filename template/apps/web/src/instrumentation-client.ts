// Runs before any other client code (Next.js client instrumentation hook).
// Imports env.ts for its side effects: setBootstrapper(bootstrap), bootstrap(),
// configureJsonApi, configureAuth, configureI18n, configureRoles, configureLogin.
// This guarantees the Modules registry is populated before any chunk that
// touches Modules.X at module-eval time can evaluate.
import "@/config/env";
