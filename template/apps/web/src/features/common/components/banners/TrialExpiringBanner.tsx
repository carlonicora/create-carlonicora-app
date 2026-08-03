"use client";

import { useSubscriptionStatus } from "@carlonicora/nextjs-jsonapi/client";
import { Link, Tooltip, TooltipContent, TooltipTrigger } from "@carlonicora/nextjs-jsonapi/components";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

export function TrialExpiringBanner() {
  const t = useTranslations("subscription");
  const status = useSubscriptionStatus();

  // Don't show for active subscriptions or when not in grace period
  if (status.status === "active" || !status.isGracePeriod) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("trial_expiring_title")}</span>
          <Link
            href="/settings/billing?action=subscribe"
            className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-6 items-center justify-center rounded-md px-2 text-xs font-medium"
          >
            {t("subscribe_now")}
          </Link>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("trial_expiring_tooltip", { days: status.daysRemaining })}</p>
      </TooltipContent>
    </Tooltip>
  );
}
