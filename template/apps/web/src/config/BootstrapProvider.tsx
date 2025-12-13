"use client";

// Import env.ts to run all configurations on the client side:
// - bootstrap() for ModuleRegistry
// - configureJsonApi() for API client
// - configureAuth() for token handling (login/logout)
// - configureI18n() for translations
// - configureRoles() for role IDs
import "@/config/env";

export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
