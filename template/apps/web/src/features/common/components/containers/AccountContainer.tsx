"use client";

import { useAccountContext } from "@/features/common/contexts/AccountContext";
import { cn } from "@/utils/cn";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import { ContentTitle, PageContentContainer, SecurityContainer } from "@carlonicora/nextjs-jsonapi/components";
import { LucideIcon, Shield } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ReactNode } from "react";

type SidebarItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  container: ReactNode;
};

export default function AccountContainer() {
  const { section, setSection } = useAccountContext();
  const t = useTranslations();
  const locale = useLocale();
  const generateUrl = usePageUrlGenerator();

  const sidebarItems: SidebarItem[] = [
    {
      id: "security",
      icon: Shield,
      label: t("common.security_settings"),
      container: <SecurityContainer />,
    },
  ];

  const selectedItem = sidebarItems.find((item) => item.id === section) || sidebarItems[0];

  return (
    <PageContentContainer
      header={<ContentTitle element={t("common.account_settings")} />}
      details={
        <nav className="space-y-4">
          <div>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSection(item.id as "security");
                    window.history.replaceState(
                      null,
                      "",
                      generateUrl({ page: "/account", id: item.id, language: locale }),
                    );
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    selectedItem?.id === item.id
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      }
      content={selectedItem ? selectedItem.container : null}
    />
  );
}
