"use client";

import {
  SettingsNavButton,
  SettingsNavLink,
  SettingsNavSection,
} from "@/features/common/components/layouts/SettingsNav";
import { useRouter } from "@/i18n/routing";
import { SettingsPageLayout } from "@/features/common/components/layouts/SettingsPageLayout";
import { useSettingsContext } from "@/features/common/contexts/SettingsContext";
import { Action, ModuleWithPermissions, Modules, getRoleId } from "@carlonicora/nextjs-jsonapi";
import {
  BillingDashboardContainer,
  ProductsAdminContainer,
  isStripeConfigured,
} from "@carlonicora/nextjs-jsonapi/billing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  AllUsersListContainer,
  CompanyEditor,
  CompanyContent,
  RoundPageContainer,
} from "@carlonicora/nextjs-jsonapi/components";
import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";

import { CompanyInterface } from "@carlonicora/nextjs-jsonapi/core";
import { Code2, LucideIcon, Package, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ReactNode, useCallback, useEffect, useState } from "react";

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
  fullWidth?: boolean;
};

export default function SettingsContainer({ children }: { children?: ReactNode }) {
  const { module, setModule } = useSettingsContext();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { hasPermissionToModule, hasRole, currentUser, company: initialCompany } = useCurrentUserContext();
  const [selectedComponent, setSelectedComponent] = useState<SidebarItem | null>(null);
  const generateUrl = usePageUrlGenerator();
  const [company, setCompany] = useState(initialCompany);

  const handleCompanyUpdate = useCallback((updated: CompanyInterface) => {
    setCompany(updated);
  }, []);

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
        label: t(`common.settings_sidebar`, { item: "company" }),
        items: [
          {
            id: "company",
            icon: Modules.Company.icon,
            container: (
              <CompanyContent
                company={company}
                actions={
                  hasPermissionToModule({ module: Modules.Company, action: Action.Update }) ? (
                    <>
                      <CompanyEditor company={company} propagateChanges={handleCompanyUpdate} />
                    </>
                  ) : undefined
                }
              />
            ),
            module: Modules.Company,
            singleItem: true,
          },
          { id: "user", icon: Modules.User.icon, container: <AllUsersListContainer />, module: Modules.User },
        ],
      }
    : null;

  const sidebars: {
    name: string;
    label?: string;
    items: SidebarItem[];
  }[] = [...(companySection ? [companySection] : []), ...(billingSection ? [billingSection] : [])];

  // Developer section with external link to OAuth pages
  const developerSection = hasRole(getRoleId().Administrator)
    ? {
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
      }
    : null;

  const selectItem = (item: SidebarItem) => {
    if (children) {
      router.push(generateUrl({ page: `/settings`, id: item.module.name }));
      return;
    }
    setModule(item.module);
    setSelectedComponent(item);
    window.history.replaceState(null, "", generateUrl({ page: `/settings`, id: item.module.name }));
  };

  useEffect(() => {
    const found = sidebars
      .map((sidebar) => sidebar.items.find((item) => item.module.name === module.name))
      .find((item) => item !== undefined);
    if (found) {
      setSelectedComponent(found);
    } else {
      setSelectedComponent(null);
      setModule(undefined);
    }
  }, [module, currentUser?.id, company]);

  const sidebar = (
    <div className="space-y-6">
      {sidebars.map((section) => (
        <SettingsNavSection
          key={section.name}
          label={section.label || t(`common.settings_sidebar`, { item: section.name })}
        >
          {section.items.map((item) => {
            if (item.hidden) return null;
            if (item.requiredPermission) {
              if (!hasPermissionToModule({ module: item.module, action: item.requiredPermission })) return null;
            } else if (!hasPermissionToModule({ module: item.module, action: Action.Read })) {
              return null;
            }
            if (item.requiredRole && !hasRole(item.requiredRole)) return null;

            return (
              <SettingsNavButton
                key={item.id}
                icon={item.icon}
                label={item.label || t(`entities.${item.module.name}`, { count: item.singleItem ? 1 : 2 })}
                isActive={selectedComponent?.id === item.id}
                onClick={() => selectItem(item)}
              />
            );
          })}
        </SettingsNavSection>
      ))}

      {developerSection && (
        <SettingsNavSection label={developerSection.label}>
          {developerSection.items.map((item) => (
            <SettingsNavLink key={item.id} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </SettingsNavSection>
      )}
    </div>
  );

  return (
    <RoundPageContainer fullWidth module={module} forceHeader>
      <SettingsPageLayout
        sidebar={sidebar}
        content={children ?? (selectedComponent ? selectedComponent.container : null)}
        fullWidth={children ? true : selectedComponent?.fullWidth}
      />
    </RoundPageContainer>
  );
}
