import { FeatureIds } from "@/enums/feature.ids";
import { ModuleWithPermissions } from "@carlonicora/nextjs-jsonapi";
import { BuildingIcon, HomeIcon, LucideIcon } from "lucide-react";

export type NavigationItem = {
  title: string;
  component?: React.ReactNode;
  url: string;
  onClick?: () => void;
  icon: LucideIcon;
  testId?: string;
  module?: ModuleWithPermissions;
  items?: NavigationItem[];
  activeUrls?: string[];
};

export type FeatureSidebarItem = {
  feature: FeatureIds;
  name: string;
  icon: LucideIcon;
};

export const getFeatureSidebarItems = (): FeatureSidebarItem[] => [];

export const addSidebarItems = (
  response: Map<string, { hasTitle: boolean; items: NavigationItem[] }>,
  t: any,
  generateUrl: any,
  isAdministrator: boolean,
): void => {
  if (isAdministrator) {
    response.get("/").items.push({
      title: t(`entities.companies`, { count: 2 }),
      url: generateUrl({ page: `/administration/companies` }),
      icon: BuildingIcon,
      testId: "sidebar-companies-link",
    });
  }
};

export const sidebarItems = (
  t: any,
  generateUrl: any,
  isAdministrator: boolean,
): Map<string, { hasTitle: boolean; items: NavigationItem[] }> => {
  const response = new Map<string, { hasTitle: boolean; items: NavigationItem[] }>([
    [
      "/",
      {
        hasTitle: false,
        items: [
          {
            title: t(`common.home`),
            url: generateUrl({ page: `/` }),
            icon: HomeIcon,
            testId: "sidebar-home-link",
            activeUrls: ["/"],
          },
        ],
      },
    ],
  ]);

  addSidebarItems(response, t, generateUrl, isAdministrator);

  return response;
};
