"use client";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@carlonicora/nextjs-jsonapi/components";
import { SquarePlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function QuickCreateMenu() {
  const t = useTranslations();
  const [menuValue, setMenuValue] = useState<string | null>(null);

  return (
    <NavigationMenu value={menuValue} onValueChange={setMenuValue}>
      <NavigationMenuList>
        <NavigationMenuItem value="quick-create">
          <NavigationMenuTrigger
            hideChevron
            aria-label={t("common.quickCreate")}
            className="bg-transparent hover:bg-muted/50 focus:bg-muted/50 data-open:bg-muted/50 data-popup-open:bg-muted/50"
          >
            <SquarePlusIcon className="text-primary size-5" />
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="p-4">
              {/* Add entity creation menu items here */}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
