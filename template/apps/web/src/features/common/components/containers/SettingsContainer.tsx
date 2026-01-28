"use client";

import { useSettingsContext } from "@/features/common/contexts/SettingsContext";
import { cn } from "@/utils/cn";
import { Action, ModuleWithPermissions, Modules, getRoleId } from "@carlonicora/nextjs-jsonapi";
import {
  BillingDashboardContainer,
  ProductsAdminContainer,
  isStripeConfigured,
} from "@carlonicora/nextjs-jsonapi/billing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  CompanyContainer,
  ContentTitle,
  PageContentContainer,
  UsersListContainer,
} from "@carlonicora/nextjs-jsonapi/components";
import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";

import { Building2Icon, Code2, LucideIcon, Package, UsersIcon, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

type SidebarItem = {
  id: string;
  icon: LucideIcon;
  label?: string;
  container: ReactNode;
  module: ModuleWithPermissions;
  singleItem?: boolean;
  requiredPermission?: Action;
  requiredRole?: string;
  hidden?: boolean;
};

export default function SettingsContainer() {
  const { module, setModule } = useSettingsContext();
  const t = useTranslations();
  const locale = useLocale();
  const { hasPermissionToModule, hasRole } = useCurrentUserContext();
  const [selectedComponent, setSelectedComponent] = useState<SidebarItem | null>(null);
  const generateUrl = usePageUrlGenerator();

  // Build sidebars array - only include billing if Stripe is configured
  const billingSection = isStripeConfigured()
    ? !hasRole(getRoleId().Administrator)
      ? {
          name: "billing",
          label: t("billing.title"),
          items: [
            {
              id: "billing",
              icon: Wallet,
              label: t("billing.title"),
              container: <BillingDashboardContainer />,
              module: Modules.Billing,
              requiredPermission: Action.Read,
              singleItem: true,
            },
          ],
        }
      : {
          name: `billing`,
          label: t("billing.title"),
          items: [
            {
              id: "stripe-products",
              icon: Package,
              label: t("billing.admin.products.title"),
              container: <ProductsAdminContainer />,
              module: Modules.StripeProduct,
              requiredRole: getRoleId().Administrator,
            },
          ],
        }
    : null;

  const companySection = !hasRole(getRoleId().Administrator)
    ? {
        name: `company`,
        items: [
          {
            id: "company",
            icon: Building2Icon,
            container: <CompanyContainer />,
            module: Modules.Company,
            singleItem: true,
          },
          { id: "user", icon: UsersIcon, container: <UsersListContainer />, module: Modules.User },
        ],
      }
    : null;

  const sidebars: {
    name: string;
    label?: string;
    items: SidebarItem[];
  }[] = [...(companySection ? [companySection] : []), ...(billingSection ? [billingSection] : [])];

  // Developer section with external link to OAuth pages
  const developerSection = {
    name: "developer",
    label: t("common.developer"),
    items: [
      {
        id: "oauth",
        icon: Code2,
        label: t("common.oauth_applications"),
        href: generateUrl({ page: "/settings/oauth" }),
      },
    ],
  };

  useEffect(() => {
    if (module) {
      const found = sidebars
        .map((sidebar) => sidebar.items.find((item) => item.module.name === module.name))
        .find((item) => item !== undefined);
      if (found) {
        setSelectedComponent(found);
      } else {
        setSelectedComponent(null);
        setModule(undefined);
      }
    } else {
      setSelectedComponent(null);
    }
  }, [module]);

  return (
    <PageContentContainer
      header={<ContentTitle element={t(`common.settings`)} />}
      details={
        <nav className="space-y-4">
          {sidebars.map((sidebar) => (
            <div key={sidebar.name}>
              <h3 className="text-muted-foreground mb-2 text-lg font-light">
                {sidebar.label || t(`common.settings_sidebar`, { item: sidebar.name })}
              </h3>
              {sidebar.items.map((item) => {
                // Check if item is hidden
                if (item.hidden) return null;

                // Check permission-based access
                if (item.requiredPermission) {
                  if (!hasPermissionToModule({ module: item.module, action: item.requiredPermission })) return null;
                } else if (!hasPermissionToModule({ module: item.module, action: Action.Read })) {
                  return null;
                }

                // Check role-based access
                if (item.requiredRole && !hasRole(item.requiredRole)) return null;

                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setModule(item.module);
                      setSelectedComponent(item);
                      window.history.replaceState(
                        null,
                        "",
                        generateUrl({ page: `/settings`, id: item.module.name, language: locale }),
                      );
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      selectedComponent?.id === item.id
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label || t(`entities.${item.module.name}`, { count: item.singleItem ? 1 : 2 })}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Developer Section - links to separate OAuth pages (Admin only) */}
          {hasRole(getRoleId().Administrator) && (
            <div>
              <h3 className="text-muted-foreground mb-2 text-lg font-light">{developerSection.label}</h3>
              {developerSection.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      }
      content={selectedComponent ? selectedComponent.container : null}
    />
  );
}
