"use client";

import { PageSkeleton } from "@/features/common/components/skeletons/PageSkeleton";
import { useRouter } from "@/i18n/navigation";
import { useSubscriptionStatus } from "@carlonicora/nextjs-jsonapi/client";
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

  // Children always render; the overlay covers them until the status is known or
  // while blocked. It is absolute, not fixed, and wraps only the content column:
  // the sidebar and header skeletons stay visible on a cold load, while no page
  // data shows before the status is known.
  const showOverlay = status.status === "loading" || status.isBlocked;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {children}
      {showOverlay && (
        <div data-testid="trial-overlay" className="bg-background absolute inset-0 z-50">
          <PageSkeleton />
        </div>
      )}
    </div>
  );
}
