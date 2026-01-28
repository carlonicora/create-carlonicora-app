"use client";

import CreationDropDown from "@/features/common/components/navigations/CreationDropDown";
import { NavigationItem, sidebarItems } from "@/features/common/components/navigations/sidebar.items";
import { UserSidebarFooter } from "@/features/common/components/navigations/UserSidebarFooter";
import { useRouter } from "@/i18n/routing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  Link,
  RecentPagesNavigator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/components";
import { recentPagesAtom, useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { Action } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { useAtomValue } from "jotai";
import { CrownIcon, HistoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useMemo, useState } from "react";

export default function CommonSidebar() {
  const { state } = useSidebar();
  const { currentUser, company, hasPermissionToPath, hasAccesToFeature, hasPermissionToModule, hasRole } =
    useCurrentUserContext();
  const generateUrl = usePageUrlGenerator();
  const t = useTranslations();
  const { notifications } = useNotificationContext();
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const recentPages = useAtomValue(recentPagesAtom);
  const router = useRouter();

  const unreadCount = useMemo(() => {
    return notifications.filter((notif) => !notif.isRead).length;
  }, [notifications]);

  const navigationMap = useMemo(() => {
    const navMap = sidebarItems(t, generateUrl, hasRole(RoleId.Administrator));

    // Add recent pages to the home section if user has a company and recent pages
    if (company && recentPages.length > 0) {
      const homeSection = navMap.get("/");
      if (homeSection) {
        homeSection.items.push({
          title: t(`common.recent_pages`),
          component: <RecentPagesNavigator />,
          url: "#",
          icon: <HistoryIcon />,
          testId: "sidebar-recent-pages",
        });
      }
    }

    return navMap;
  }, [currentUser, company, recentPages, t, generateUrl, hasRole]);

  return (
    <Sidebar data-testid="sidebar-container" collapsible="icon">
      <SidebarHeader>
        <Link
          href={generateUrl({ page: `/` })}
          className="mb-4 flex max-h-32 w-full items-center justify-center text-2xl font-semibold"
        >
          {state === "expanded" ? (
            <Image
              src={`/logo.webp`}
              className="max-h-32 object-contain p-4"
              height={300}
              width={300}
              alt={"Logo"}
              priority
            />
          ) : (
            <Image
              src={`/logo.webp`}
              className="max-h-10 object-contain"
              height={300}
              width={300}
              alt={"Logo"}
              priority
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className={`py-0 ${state === "collapsed" ? "pb-4" : "pb-1"}`}>
          {state === "expanded" ? (
            <SidebarGroupContent className="flex flex-col gap-2">
              <CreationDropDown />
            </SidebarGroupContent>
          ) : (
            <SidebarGroupContent className="flex flex-col gap-2">
              <CreationDropDown />
            </SidebarGroupContent>
          )}
        </SidebarGroup>
        {Array.from(navigationMap.entries())
          .filter(([groupLabel, items]) => items.items.length > 0)
          .map(([groupLabel, items]) => (
            <SidebarGroup key={groupLabel} className={`py-0 ${state === "collapsed" ? "pb-4" : "pb-1"}`}>
              {groupLabel !== "/" && state !== "collapsed" && items.hasTitle && (
                <SidebarGroupLabel className="min-h-10 font-semibold">
                  {t(`common.sidebar`, { type: groupLabel })}
                </SidebarGroupLabel>
              )}
              <SidebarMenu className="gap-0">
                {items.items.map((item: NavigationItem) => {
                  if (item.url && !hasPermissionToPath(item.url)) return null;
                  if (item.module && !hasPermissionToModule({ module: item.module, action: Action.Read })) return null;

                  const isDropdown = item.url === "#" && item.component;

                  const handleNavClick = () => {
                    if (item.onClick) {
                      item.onClick();
                    }
                    if (item.url && item.url !== "#") {
                      router.push(item.url);
                    }
                  };

                  return (
                    <SidebarMenuItem key={item.title} className="">
                      {isDropdown ? (
                        <SidebarMenuButton
                          render={undefined}
                          className="text-muted-foreground"
                          data-testid={item.testId}
                          tooltip={item.title}
                        >
                          {item.icon}
                          {item.component}
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          render={undefined}
                          className="text-muted-foreground cursor-pointer"
                          data-testid={item.testId}
                          onClick={handleNavClick}
                          tooltip={item.title}
                        >
                          {item.icon}
                          {item.component ? item.component : <span>{item.title}</span>}
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        {company && !company.isActiveSubscription && (
          <SidebarGroup className="mt-auto px-2 pb-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={undefined}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  tooltip={t("common.upgrade")}
                  onClick={() => router.push("/settings/billing?action=subscribe")}
                >
                  <CrownIcon className="h-4 w-4" />
                  {state === "expanded" && <span>{t("common.upgrade")}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <UserSidebarFooter
          notificationModalOpen={notificationModalOpen}
          setNotificationModalOpen={setNotificationModalOpen}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
