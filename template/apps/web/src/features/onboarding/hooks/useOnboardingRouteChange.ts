"use client";

import { useOnboarding } from "@carlonicora/nextjs-jsonapi/contexts";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function useOnboardingRouteChange() {
  const pathname = usePathname();
  const { closeTour, isTourActive } = useOnboarding();
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current !== pathname && isTourActive) {
      closeTour();
    }
    previousPathRef.current = pathname;
  }, [pathname, isTourActive, closeTour]);
}
