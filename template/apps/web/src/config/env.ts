import { bootstrap } from "@/config/Bootstrapper";
import { ENV } from "@/config/middleware-env";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useDateFnsLocale } from "@/i18n/useDateFnsLocale";
import { removeToken, updateToken } from "@/server-actions/auth-cookies";
import { configureAuth, configureI18n, configureJsonApi, configureRoles, Modules } from "@carlonicora/nextjs-jsonapi";
import { RoleId } from "@{{name}}/shared";
import { useLocale, useTranslations } from "next-intl";

// Re-export ENV for use by non-middleware code
export { ENV };

// Bootstrap modules immediately when this file is imported
// This ensures modules are registered before any component accesses Modules
bootstrap();

// Validate required env vars
if (!ENV.API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is required but not set");
}

if (!ENV.APP_URL) {
  throw new Error("NEXT_PUBLIC_ADDRESS is required but not set");
}

// Configure JSON:API client
configureJsonApi({
  apiUrl: ENV.API_URL,
  appUrl: ENV.APP_URL,
  trackablePages: [Modules.Notification, Modules.Company, Modules.User],
  bootstrapper: bootstrap,
});

// Configure auth token handling (Server Actions for cookie management)
configureAuth({
  updateToken,
  removeToken,
});

// Configure i18n (router, translations, link component, locale)
configureI18n({
  useRouter,
  useTranslations,
  useLocale,
  useDateFnsLocale,
  Link,
  usePathname,
});

// Configure role IDs for role-based access control
configureRoles(RoleId);
