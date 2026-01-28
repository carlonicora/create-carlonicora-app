import { ModuleWithPermissions } from "@carlonicora/nextjs-jsonapi";
import { HomeIcon } from "lucide-react";
import { ReactNode } from "react";

export type NavigationItem = {
  title: string;
  component?: React.ReactNode;
  url: string;
  onClick?: () => void;
  icon: ReactNode;
  testId?: string;
  module?: ModuleWithPermissions;
  items?: NavigationItem[];
};

export const sidebarItems = (
  t: any,
  generateUrl: any,
  isAdministrator: boolean,
): Map<string, { hasTitle: boolean; items: NavigationItem[] }> => {
  const response = new Map([
    [
      "/",
      {
        hasTitle: false,
        items: [
          {
            title: t(`common.home`),
            url: generateUrl({ page: `/` }),
            icon: <HomeIcon />,
            testId: "sidebar-home-link",
          },
        ],
      },
    ],
  ]);

  return response;
};
