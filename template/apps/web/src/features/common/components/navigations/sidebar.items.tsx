import { FeatureIds } from "@/enums/feature.ids";
import { ModuleWithPermissions } from "@carlonicora/nextjs-jsonapi";
import { HomeIcon, LucideIcon } from "lucide-react";

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

/**
 * Extension point: a scaffolded app adds ITS OWN navigation items here.
 *
 * Deliberately empty. Administration links (companies, users, token-usage,
 * ai-connections, products) are owned by CommonSidebar's administration group,
 * which gates them on RoleId.Administrator. Pushing an admin link here as well
 * renders it twice and duplicates its testId, which breaks strict-mode locators.
 */
export const addSidebarItems = (
  _response: Map<string, { hasTitle: boolean; items: NavigationItem[] }>,
  _t: any,
  _generateUrl: any,
  _isAdministrator: boolean,
): void => {};

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
