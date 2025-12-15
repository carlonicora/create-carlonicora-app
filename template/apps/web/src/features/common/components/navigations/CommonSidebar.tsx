"use client";

import CreationDropDown from "@/features/common/components/navigations/CreationDropDown";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/components";
import { recentPagesAtom, useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";

import { UserSidebarFooter } from "@/features/common/components/navigations/UserSidebarFooter";
import { useAtomValue } from "jotai";
import { HistoryIcon, HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Fragment, ReactNode, useMemo, useState } from "react";

export type NavigationItem = {
  title: string;
  component?: React.ReactNode;
  url: string;
  onClick?: () => void;
  icon: ReactNode;
  testId?: string;
};

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
    const navMap = new Map<string, { hasTitle: boolean; items: NavigationItem[] }>([
      ["/", { hasTitle: false, items: [] }],
      ["expertise", { hasTitle: true, items: [] }],
      // ["knowledge", { hasTitle: true, items: [] }],
    ]);

    navMap.get("/")?.items.push({
      title: t(`generic.home`),
      url: generateUrl({ page: `/` }),
      icon: <HomeIcon />,
      testId: "sidebar-home-link",
    });

    if (company) {
      if (recentPages.length > 0) {
        navMap.get("/")?.items.push({
          title: t(`generic.recent_pages`),
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
              src={`/{{name}}-logo.webp`}
              className="max-h-32 object-contain p-4"
              height={300}
              width={300}
              alt={"Phlow"}
              priority
            />
          ) : (
            <Image
              src={`/{{name}}-logo.webp`}
              className="max-h-10 object-contain"
              height={300}
              width={300}
              alt={"Phlow"}
              priority
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className={`py-0 ${state === "collapsed" ? "pb-4" : "pb-1"}`}>
          {state === "expanded" ? (
            <SidebarGroupContent className="flex flex-col gap-2">
              {/* <SidebarMenu>
                <Button
                  onClick={() => router.push(generateUrl({ page: Modules.Conversation }))}
                  variant={"link"}
                  className="relative h-12 w-full cursor-pointer p-0"
                  data-testid="sidebar-query-knowledge-button"
                >
                  <Input
                    placeholder={t(`generic.query_knowledge`)}
                    type="text"
                    className="border-primary text-muted m-0 w-full cursor-pointer"
                  />
                  <div className="text-muted-foreground absolute top-3.5 right-10 flex flex-row gap-x-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md border text-xs">⌘</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md border text-xs">K</span>
                  </div>
                  <div className="text-muted-foreground absolute top-3 right-2 flex flex-row gap-x-2">
                    <span className="bg-accent flex h-6 w-6 items-center justify-center rounded-md border text-xs">
                      <SparklesIcon className="text-muted h-5 w-5" />
                    </span>
                  </div>
                </Button>
              </SidebarMenu> */}
              <CreationDropDown />
            </SidebarGroupContent>
          ) : (
            <SidebarGroupContent className="flex flex-col gap-2">
              {/* <SidebarMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => router.push(generateUrl({ page: Modules.Conversation }))}
                      className="bg-accent relative cursor-pointer"
                      data-testid="sidebar-query-knowledge-button"
                    >
                      <SparklesIcon className="text-muted h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t(`generic.query_knowledge`)}</TooltipContent>
                </Tooltip>
              </SidebarMenu> */}
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
                  {t(`generic.sidebar`, { type: groupLabel })}
                </SidebarGroupLabel>
              )}
              <SidebarMenu className="gap-0">
                {items.items.map((item) => {
                  if (item.url && !hasPermissionToPath(item.url)) return null;

                  const isDropdown = item.url === "#" && item.component;

                  return (
                    <Fragment key={item.title}>
                      {state === "collapsed" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {isDropdown ? (
                              <SidebarMenuButton className="text-muted-foreground" data-testid={item.testId}>
                                {item.component}
                              </SidebarMenuButton>
                            ) : (
                              <SidebarMenuButton
                                asChild
                                className="text-muted-foreground cursor-pointer"
                                data-testid={item.testId}
                                onClick={item.onClick}
                              >
                                <Link href={item.url ? item.url : "#"}>
                                  {item.icon}
                                  {item.component ? item.component : <span>{item.title}</span>}
                                </Link>
                              </SidebarMenuButton>
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <SidebarMenuButton asChild={!isDropdown} data-testid={item.testId} onClick={item.onClick}>
                          {isDropdown ? (
                            <div className="text-muted-foreground flex w-full items-center gap-2">
                              {item.icon}
                              {item.component}
                            </div>
                          ) : (
                            <Link href={item.url ? item.url : "#"} className="text-muted-foreground cursor-pointer">
                              {item.icon}
                              {item.component ? item.component : <span>{item.title}</span>}
                            </Link>
                          )}
                        </SidebarMenuButton>
                      )}
                    </Fragment>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
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
