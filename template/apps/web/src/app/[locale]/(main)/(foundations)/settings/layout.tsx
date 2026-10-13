"use client";

// A static import, not next/dynamic with ssr: false: that rendered nothing on the
// server, so every settings page was missing from the prerendered shell and Next
// could not validate its navigations. This layout is only loaded on settings
// routes, so Stripe.js still stays out of every other page's bundle.
import { StripeProvider } from "@carlonicora/nextjs-jsonapi/billing";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <StripeProvider>{children}</StripeProvider>;
}
