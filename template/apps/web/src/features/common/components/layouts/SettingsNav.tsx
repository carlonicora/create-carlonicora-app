"use client";

import { cn } from "@/utils/cn";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export type SettingsNavItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  isActive?: boolean;
};

type SettingsNavSectionProps = {
  label: string;
  children: ReactNode;
};

export function SettingsNavSection({ label, children }: SettingsNavSectionProps) {
  return (
    <div>
      <h3 className="text-muted-foreground mb-2 text-sm font-medium uppercase tracking-wide">{label}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

type SettingsNavButtonProps = {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export function SettingsNavButton({ icon: Icon, label, isActive, onClick }: SettingsNavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

type SettingsNavLinkProps = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export function SettingsNavLink({ icon: Icon, label, href }: SettingsNavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
