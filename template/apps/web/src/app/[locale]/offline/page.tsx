"use client";

import { Button } from "@carlonicora/nextjs-jsonapi/components";
import { WifiOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

export default function OfflinePage() {
  const t = useTranslations("offline");

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <div className="bg-muted mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <WifiOff className="text-muted-foreground h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mb-6 max-w-md">{t("description")}</p>
        <Button onClick={handleRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
