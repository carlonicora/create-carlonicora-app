"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

interface OfflineIndicatorProps {
  isVisible: boolean;
}

export function OfflineIndicator({ isVisible }: OfflineIndicatorProps) {
  const t = useTranslations("offline");

  if (!isVisible) return null;

  return (
    <div className="bg-warning text-warning-foreground fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
      <WifiOff className="h-4 w-4" />
      <span>{t("banner")}</span>
    </div>
  );
}
