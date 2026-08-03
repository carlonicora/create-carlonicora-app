"use client";

import { CommandGroup, CommandItem, HowToCommand, SidebarMenuItem } from "@carlonicora/nextjs-jsonapi/components";
import { useOnboarding } from "@carlonicora/nextjs-jsonapi/contexts";
import { getTourForPath, getTourSteps } from "@/features/onboarding/config/tours.config";
import { usePathname } from "@/i18n/routing";
import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export default function AppHowToCommand() {
  const t = useTranslations();
  const pathname = usePathname();
  const { startTour, isTourActive } = useOnboarding();

  const tourName = useMemo(() => getTourForPath(pathname), [pathname]);

  const extraGroups = useMemo(() => {
    if (!tourName || isTourActive) return null;

    return (
      <CommandGroup heading={t(`howto.command.quick_actions`)}>
        <CommandItem
          onSelect={() => {
            const steps = getTourSteps(tourName);
            startTour(tourName, steps);
          }}
          className="cursor-pointer"
        >
          <Compass className="h-4 w-4" />
          <span>{t(`howto.command.tour_button`)}</span>
        </CommandItem>
      </CommandGroup>
    );
  }, [tourName, isTourActive, t, startTour]);

  return (
    <SidebarMenuItem>
      <HowToCommand pathname={pathname} extraGroups={extraGroups} />
    </SidebarMenuItem>
  );
}
