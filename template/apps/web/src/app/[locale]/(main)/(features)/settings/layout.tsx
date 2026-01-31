"use client";

import dynamic from "next/dynamic";

const StripeProvider = dynamic(
  () => import("@carlonicora/nextjs-jsonapi/billing").then((mod) => mod.StripeProvider),
  { ssr: false }
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <StripeProvider>{children}</StripeProvider>;
}
