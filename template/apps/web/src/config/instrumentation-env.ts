/**
 * Everything env.ts configures except i18n, which is the part instrumentation.ts loads.
 *
 * configureI18n takes next-intl's hooks and navigation, and next-intl loads
 * i18n/request.ts, which reads `next/root-params`. That module is only allowed inside
 * the app directory, so it must not be reachable from instrumentation. env.ts imports
 * this file and adds the i18n configuration; app code keeps importing env.ts.
 */
import { bootstrap } from "@/config/Bootstrapper";
import { ENV } from "@/config/middleware-env";
import { removeToken, updateToken } from "@/server-actions/auth-cookies";
import { configureAuth, configureJsonApi, configureLogin, configureRoles } from "@carlonicora/nextjs-jsonapi";
import { Modules } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import "./waitlist.config";

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
  stripePublishableKey: ENV.STRIPE_PUBLISHABLE_KEY,
});

// Configure auth token handling (Server Actions for cookie management)
configureAuth({
  updateToken,
  removeToken,
});

// Configure role IDs for role-based access control
configureRoles(RoleId);

// Configure login providers (auto-detected from client IDs)
configureLogin({
  discordClientId: ENV.DISCORD_CLIENT_ID,
  googleClientId: ENV.GOOGLE_CLIENT_ID,
  useInternalAuth: true,
  registrationMode: ENV.REGISTRATION_MODE,
});
