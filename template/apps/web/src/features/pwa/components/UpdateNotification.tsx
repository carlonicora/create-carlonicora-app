"use client";

import { Button } from "@carlonicora/nextjs-jsonapi/components";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

interface UpdateNotificationProps {
  isVisible: boolean;
  onRefresh: () => void;
}

export function UpdateNotification({ isVisible, onRefresh }: UpdateNotificationProps) {
  const t = useTranslations("pwa.update");

  if (!isVisible) return null;

  return (
    <div className="bg-primary text-primary-foreground fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg">
      <RefreshCw className="h-4 w-4" />
      <span className="text-sm">{t("available")}</span>
      <Button variant="secondary" size="sm" onClick={onRefresh}>
        {t("button")}
      </Button>
    </div>
  );
}
