"use client";

import { Button } from "@carlonicora/nextjs-jsonapi/components";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface InstallPromptProps {
  isIOS: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({ isIOS, onInstall, onDismiss }: InstallPromptProps) {
  const t = useTranslations("pwa.install");

  return (
    <div className="bg-card border-border fixed right-4 bottom-4 left-4 z-50 rounded-lg border p-4 shadow-lg md:right-4 md:left-auto md:w-96">
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Download className="text-primary h-5 w-5" />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold">{t("title")}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{isIOS ? t("ios_description") : t("description")}</p>

          {isIOS ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Share className="h-4 w-4" />
                <span>{t("ios_step1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center text-xs">+</span>
                <span>{t("ios_step2")}</span>
              </div>
            </div>
          ) : (
            <Button onClick={onInstall} size="sm" className="mt-3">
              {t("button")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
