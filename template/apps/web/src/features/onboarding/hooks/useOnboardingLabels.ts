"use client";

import { OnboardingLabels } from "@carlonicora/nextjs-jsonapi/contexts";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export function useOnboardingLabels(): OnboardingLabels {
  const t = useTranslations();

  return useMemo(
    () => ({
      next: t("tour.next"),
      previous: t("tour.previous"),
      finish: t("tour.finish"),
      skip: t("tour.skip"),
      close: t("tour.close"),
      stepCounter: (current, total) => t("tour.step_counter", { current, total }),
    }),
    [t],
  );
}
