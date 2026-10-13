"use client";

import { OnboardingProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Suspense } from "react";
import { useOnboardingLabels } from "../hooks/useOnboardingLabels";
import { useOnboardingRouteChange } from "../hooks/useOnboardingRouteChange";

function RouteChangeHandler() {
  useOnboardingRouteChange();
  return null;
}

export function OnboardingProviderWrapper({ children }: { children: React.ReactNode }) {
  const labels = useOnboardingLabels();

  return (
    <OnboardingProvider labels={labels}>
      {/* The handler reads the pathname, which suspends during the shell prerender:
          its own boundary keeps {children} out of that suspension. */}
      <Suspense fallback={null}>
        <RouteChangeHandler />
      </Suspense>
      {children}
    </OnboardingProvider>
  );
}
