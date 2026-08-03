"use client";

import { cn } from "@/utils/cn";
import { ReactNode } from "react";

type SettingsPageLayoutProps = {
  sidebar: ReactNode;
  content: ReactNode;
  fullWidth?: boolean;
};

export function SettingsPageLayout({ sidebar, content, fullWidth }: SettingsPageLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1">
        <nav className="w-56 shrink-0 overflow-y-auto border-r p-4">{sidebar}</nav>
        <main className={cn(`flex-1 overflow-y-auto`, !fullWidth && `p-4`)}>{content}</main>
      </div>
    </div>
  );
}
