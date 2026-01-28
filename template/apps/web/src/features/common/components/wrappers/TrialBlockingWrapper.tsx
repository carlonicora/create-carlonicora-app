"use client";

import { useSubscriptionStatus } from "@carlonicora/nextjs-jsonapi/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function TrialBlockingWrapper({ children }: { children: React.ReactNode }) {
  const status = useSubscriptionStatus();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when NOT loading and IS blocked
    if (status.status !== "loading" && status.isBlocked) {
      router.replace("/trial-expired");
    }
  }, [status.status, status.isBlocked, router]);

  // Show nothing while loading
  if (status.status === "loading") {
    return null;
  }

  if (status.isBlocked) return null;

  return <>{children}</>;
}
