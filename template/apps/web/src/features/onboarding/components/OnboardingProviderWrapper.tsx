"use client";

import { OnboardingProvider } from "@carlonicora/nextjs-jsonapi/contexts";
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
      <RouteChangeHandler />
      {children}
    </OnboardingProvider>
  );
}
