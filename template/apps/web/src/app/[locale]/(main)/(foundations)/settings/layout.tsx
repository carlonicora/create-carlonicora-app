"use client";

import dynamic from "next/dynamic";

// ssr: false keeps @stripe/stripe-js out of the server bundle. StripeProvider
// renders children untouched when no publishable key is configured, so this is
// safe with Stripe disabled.
const StripeProvider = dynamic(() => import("@carlonicora/nextjs-jsonapi/billing").then((mod) => mod.StripeProvider), {
  ssr: false,
});

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <StripeProvider>{children}</StripeProvider>;
}
