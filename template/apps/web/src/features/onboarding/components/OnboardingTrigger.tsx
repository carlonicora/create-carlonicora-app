"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@carlonicora/nextjs-jsonapi/components";
import { useOnboarding } from "@carlonicora/nextjs-jsonapi/contexts";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { getTourForPath, getTourSteps } from "../config/tours.config";

export function OnboardingTrigger() {
  const { startTour, isTourActive } = useOnboarding();
  const pathname = usePathname();
  const t = useTranslations();

  const tourName = getTourForPath(pathname);

  // Don't render if no tour for this page or tour is active
  if (!tourName || isTourActive) return null;

  const handleClick = () => {
    const steps = getTourSteps(tourName);
    if (steps.length > 0) {
      startTour(tourName, steps);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={undefined}
        className="text-muted-foreground"
        tooltip={t("common.page_tour")}
        onClick={handleClick}
        data-testid="sidebar-tour-trigger"
        id="sidebar-tour-trigger"
      >
        <HelpCircle className="h-4 w-4" />
        <span>{t("common.page_tour")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
