"use client";

import { cn } from "@/utils/cn";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";

type VisibilityBadgeProps = {
  isPublic: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function VisibilityBadge({ isPublic, className, size = "sm" }: VisibilityBadgeProps) {
  const t = useTranslations();

  if (!isPublic) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        className,
      )}
      title={t("common.visibility.public_tooltip")}
    >
      <Globe className={cn(size === "sm" && "h-3 w-3", size === "md" && "h-4 w-4")} />
      <span className="font-medium">{t("common.visibility.public")}</span>
    </div>
  );
}
