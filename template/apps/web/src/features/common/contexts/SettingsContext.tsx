"use client";

import { BreadcrumbItemData, Modules, ModuleWithPermissions } from "@carlonicora/nextjs-jsonapi";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import { SharedProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { useTranslations } from "next-intl";
import { createContext, ReactNode, useContext, useState } from "react";

interface SettingsContextType {
  module?: ModuleWithPermissions;
  setModule: (module: ModuleWithPermissions | undefined) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

type SettingsProviderProps = {
  children: ReactNode;
  moduleName?: string;
};

export const SettingsProvider = ({ children, moduleName }: SettingsProviderProps) => {
  const [module, setModule] = useState<ModuleWithPermissions | undefined>(
    moduleName ? Modules.findByName(moduleName) : undefined,
  );
  const generateUrl = usePageUrlGenerator();
  const t = useTranslations();

  const breadcrumb = () => {
    const response: BreadcrumbItemData[] = [];

    response.push({
      name: t(`common.settings`),
      href: generateUrl({ page: `/settings` }),
    });

    if (module)
      response.push({
        name: t(`entities.${module.name}`, { count: 2 }),
        href: generateUrl({ page: `/settings`, id: module.name }),
      });

    return response;
  };

  const title = () => {
    const response: any = {
      type: t(`common.settings`),
    };

    if (module)
      response.element = t(`entities.${module.name}`, { count: module.name === Modules.Company.name ? 1 : 2 });

    return response;
  };

  return (
    <SharedProvider value={{ breadcrumbs: breadcrumb(), title: title() }}>
      <SettingsContext.Provider
        value={{
          module: module,
          setModule: setModule,
        }}
      >
        {children}
      </SettingsContext.Provider>
    </SharedProvider>
  );
};

export const useSettingsContext = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettingsContext must be used within a SettingsProvider");
  }
  return context;
};
