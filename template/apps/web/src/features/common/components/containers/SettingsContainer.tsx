"use client";

import OAuthClientListContainer from "@/features/common/components/containers/OAuthClientListContainer";
import UserProfileContainer, { PROFILE_SECTION } from "@/features/common/components/containers/UserProfileContainer";
import { SettingsSectionActionsProvider } from "@/features/common/contexts/SettingsSectionActionsContext";
import {
  BillingDashboardContainer,
  ProductProvider,
  ProductsList,
  isStripeConfigured,
} from "@carlonicora/nextjs-jsonapi/billing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  AllUsersListContainer,
  CompanyContent,
  CompanyEditor,
  RoundPageContainer,
  Tab,
} from "@carlonicora/nextjs-jsonapi/components";
import { SharedProvider, useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import {
  Action,
  BreadcrumbItemData,
  CompanyInterface,
  ModuleWithPermissions,
  Modules,
} from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { useTranslations } from "next-intl";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

/**
 * One settings rail section. `visible` carries each section's own gate verbatim
 * rather than a generic permission DSL, because the gates genuinely differ:
 * some are role-only, some permission-only, some both.
 */
type SettingsItem = {
  section: string;
  label: string;
  content: ReactNode;
  group: string;
  key?: ModuleWithPermissions;
  visible: boolean;
};

export default function SettingsContainer({ initialSection }: { initialSection: string }) {
  const t = useTranslations();
  const generateUrl = usePageUrlGenerator();
  const { hasPermissionToModule, hasRole, company: initialCompany } = useCurrentUserContext();

  // Active rail section, seeded from the server-read ?section=. Mirrored in
  // state via onSectionChange because the rail writes the URL with
  // history.replaceState, which does not re-render this ancestor — and the
  // breadcrumb and the title both depend on it.
  const [section, setSection] = useState(initialSection);
  const [company, setCompany] = useState(initialCompany);

  // The current user is stored in an atomWithStorage whose getOnInit is false,
  // so the FIRST client render sees company === null and the real value only
  // arrives on the mount effect. useState captures that first value only, so
  // without this sync the Company pane would stay null forever and
  // CompanyContent would render nothing.
  useEffect(() => {
    setCompany(initialCompany);
  }, [initialCompany]);

  // Sections mount as tab *content* — descendants of the shared header — so they
  // cannot feed `title.functions` upward directly. Each publishes here, keyed by
  // section; only the active section's node reaches the header below.
  const [actionsBySection, setActionsBySection] = useState<Record<string, ReactNode>>({});
  const registerSectionActions = useCallback((sectionKey: string, actions: ReactNode) => {
    setActionsBySection((prev) => ({ ...prev, [sectionKey]: actions }));
  }, []);
  const sectionActionsValue = useMemo(() => ({ register: registerSectionActions }), [registerSectionActions]);

  const handleCompanyUpdate = useCallback((updated: CompanyInterface) => {
    setCompany(updated);
  }, []);

  const isAdministrator = hasRole(RoleId.Administrator);

  const companyGroup = t(`common.settings_sidebar`, { item: "company" });
  const billingGroup = t(`billing.title`);
  const developerGroup = t(`common.developer`);

  const items: SettingsItem[] = [
    {
      section: Modules.Company.name,
      key: Modules.Company,
      group: companyGroup,
      label: t(`entities.${Modules.Company.name}`, { count: 1 }),
      visible: !isAdministrator && hasPermissionToModule({ module: Modules.Company, action: Action.Read }),
      content: (
        <CompanyContent
          company={company}
          actions={
            hasPermissionToModule({ module: Modules.Company, action: Action.Update }) ? (
              <CompanyEditor company={company} propagateChanges={handleCompanyUpdate} />
            ) : undefined
          }
        />
      ),
    },
    {
      section: Modules.User.name,
      key: Modules.User,
      group: companyGroup,
      label: t(`entities.${Modules.User.name}`, { count: 2 }),
      visible: !isAdministrator && hasPermissionToModule({ module: Modules.User, action: Action.Read }),
      content: <AllUsersListContainer />,
    },
    {
      section: Modules.Billing.name,
      key: Modules.Billing,
      group: billingGroup,
      label: t(`billing.title`),
      visible:
        isStripeConfigured() &&
        !isAdministrator &&
        hasPermissionToModule({ module: Modules.Billing, action: Action.Read }),
      content: <BillingDashboardContainer />,
    },
    {
      section: Modules.StripeProduct.name,
      key: Modules.StripeProduct,
      group: billingGroup,
      label: t(`billing.admin.products.title`),
      visible:
        isStripeConfigured() &&
        isAdministrator &&
        hasPermissionToModule({ module: Modules.StripeProduct, action: Action.Read }),
      // `ProductProvider publishChrome={false}` + `ProductsList`, NOT the
      // package's `ProductsListContainer`: that container wraps itself in its own
      // RoundPageContainer, which inside the rail nests a second header,
      // breadcrumb bar and title row on top of this pane's own — and its
      // ProductProvider would publish its own chrome, which SharedProvider
      // REPLACES rather than merges, blanking this page's title.
      content: (
        <ProductProvider publishChrome={false}>
          <ProductsList fullWidth />
        </ProductProvider>
      ),
    },
    {
      section: Modules.OAuth.name,
      key: Modules.OAuth,
      group: developerGroup,
      label: t(`common.oauth_applications`),
      // Role-only, matching the pre-rail Developer link, which carried no module
      // and therefore no permission check.
      visible: isAdministrator,
      content: <OAuthClientListContainer />,
    },
  ];

  const visibleItems = items.filter((item) => item.visible);
  const profileLabel = t(`common.my_profile`);

  const tabs: Tab[] = [
    { sectionKey: PROFILE_SECTION, label: profileLabel, content: <UserProfileContainer /> },
    ...visibleItems.map((item) => ({
      key: item.key,
      sectionKey: item.section,
      label: item.label,
      content: item.content,
      group: item.group,
    })),
  ];

  const activeItem = visibleItems.find((item) => item.section === section);
  const activeLabel = section === PROFILE_SECTION ? profileLabel : activeItem?.label;

  const breadcrumbs: BreadcrumbItemData[] = [{ name: t(`common.settings`), href: generateUrl({ page: `/settings` }) }];
  if (activeLabel)
    breadcrumbs.push({
      name: activeLabel,
      href: generateUrl({ page: `/settings`, additionalParameters: { section } }),
    });

  // No page title is rendered here: the pane's breadcrumb and RoundPageContainer
  // title strip already name the section, and a role-1 title on a settings
  // sub-page triples up with them.
  return (
    <SettingsSectionActionsProvider value={sectionActionsValue}>
      <SharedProvider
        value={{
          breadcrumbs,
          title: { type: t(`common.settings`), element: activeLabel, functions: actionsBySection[section] },
        }}
      >
        <RoundPageContainer layout="rail" tabs={tabs} onSectionChange={setSection} />
      </SharedProvider>
    </SettingsSectionActionsProvider>
  );
}
