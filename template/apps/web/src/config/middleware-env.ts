/**
 * Middleware-safe environment configuration
 * This file ONLY exports ENV constants without any library imports
 * It's safe to use in Next.js middleware which has restricted module support
 */

export const ENV = {
  API_URL:
    (typeof window === "undefined" ? process.env.API_INTERNAL_URL : undefined) || process.env.NEXT_PUBLIC_API_URL!,
  APP_URL: process.env.NEXT_PUBLIC_ADDRESS
    ? process.env.NEXT_PUBLIC_ADDRESS.trim().replace(/\/+$/, "") // Trim whitespace & remove trailing slashes
    : "",
  VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  ALLOW_REGISTRATION: process.env.NEXT_PUBLIC_ALLOW_REGISTRATION !== "false",
  REGISTRATION_MODE: (process.env.NEXT_PUBLIC_REGISTRATION_MODE as "open" | "closed" | "waitlist") || "open",
  DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
} as const;
