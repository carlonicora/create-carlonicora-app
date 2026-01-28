"use client";

import { BreadcrumbItemData } from "@carlonicora/nextjs-jsonapi";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import { SharedProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { useTranslations } from "next-intl";
import { createContext, ReactNode, useContext, useState } from "react";

type AccountSection = "security";

interface AccountContextType {
  section: AccountSection;
  setSection: (section: AccountSection) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

type AccountProviderProps = {
  children: ReactNode;
  initialSection?: AccountSection;
};

export const AccountProvider = ({ children, initialSection = "security" }: AccountProviderProps) => {
  const [section, setSection] = useState<AccountSection>(initialSection);
  const generateUrl = usePageUrlGenerator();
  const t = useTranslations();

  const breadcrumb = (): BreadcrumbItemData[] => {
    const response: BreadcrumbItemData[] = [];

    response.push({
      name: t("common.account_settings"),
      href: generateUrl({ page: "/account" }),
    });

    return response;
  };

  const title = () => ({
    type: t("common.account_settings"),
  });

  return (
    <SharedProvider value={{ breadcrumbs: breadcrumb(), title: title() }}>
      <AccountContext.Provider
        value={{
          section,
          setSection,
        }}
      >
        {children}
      </AccountContext.Provider>
    </SharedProvider>
  );
};

export const useAccountContext = (): AccountContextType => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccountContext must be used within an AccountProvider");
  }
  return context;
};
