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
} as const;
