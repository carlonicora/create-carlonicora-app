"use client";

import {
  addSidebarItems,
  getFeatureSidebarItems,
  NavigationItem,
} from "@/features/common/components/navigations/sidebar.items";
import { UserSidebarFooter } from "@/features/common/components/navigations/UserSidebarFooter";
import { useRouter } from "@/i18n/routing";
import { isStripeConfigured } from "@carlonicora/nextjs-jsonapi/billing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Link,
  RecentPagesNavigator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/components";
import { recentPagesAtom, useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { Action, Modules, ModuleWithPermissions } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { useAtomValue } from "jotai";
import { CrownIcon, HistoryIcon, HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

enum SidebarType {
  Default = "default",
  Feature = "feature",
}

export default function CommonSidebar() {
  const { state } = useSidebar();
  const { currentUser, company, hasPermissionToPath, hasAccesToFeature, hasPermissionToModule, hasRole } =
    useCurrentUserContext();
  const generateUrl = usePageUrlGenerator();
  const t = useTranslations();
  const { notifications } = useNotificationContext();
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [openHoverCard, setOpenHoverCard] = useState<string | null>(null);
  const recentPages = useAtomValue(recentPagesAtom);
  const router = useRouter();
  const pathname = usePathname();

  const unreadCount = useMemo(() => {
    return notifications.filter((notif) => !notif.isRead).length;
  }, [notifications]);

  const sidebarType: SidebarType = SidebarType.Feature;

  const navigationMap = useMemo(() => {
    const response = new Map<string, { items: NavigationItem[]; hasTitle: boolean }>();

    response.set("/", {
      items: [
        {
          title: t(`common.home`),
          url: generateUrl({ page: `/` }),
          icon: HomeIcon,
          testId: "sidebar-home-link",
          activeUrls: ["/"],
        },
      ],
      hasTitle: false,
    });

    if (company && recentPages.length > 0) {
      response.get("/").items.push({
        title: t(`common.recent_pages`),
        component: <RecentPagesNavigator />,
        url: "#",
        icon: HistoryIcon,
        testId: "sidebar-recent-pages",
      });
    }

    if (sidebarType === SidebarType.Feature && !hasRole(RoleId.Administrator)) {
      // Build favourites group from current user data
      const userFavourites = (currentUser as { sidebarFavourites?: string[] })?.sidebarFavourites ?? [];
      if (userFavourites.length > 0) {
        const favouriteItems: NavigationItem[] = [];

        for (const moduleName of userFavourites) {
          try {
            const m = Modules.findByName(moduleName);
            if (
              !m.pageUrl ||
              (m.feature && !hasAccesToFeature(m.feature)) ||
              !hasPermissionToModule({ module: m, action: Action.Read }) ||
              !t.has(`entities.${m.name}`)
            ) {
              continue;
            }
            favouriteItems.push({
              title: t(`entities.${m.name}`, { count: 2 }),
              url: generateUrl({ page: m }),
              icon: m.icon,
              testId: `sidebar-fav-${m.name}-link`,
              activeUrls: [m.pageUrl],
            });
          } catch {
            // findByName throws if module not found — skip stale names
          }
        }

        // Sort alphabetically by translated name
        favouriteItems.sort((a, b) => a.title.localeCompare(b.title));

        if (favouriteItems.length > 0) {
          response.set("favourites", {
            items: favouriteItems,
            hasTitle: true,
          });
        }
      }

      response.set("features", {
        items: [],
        hasTitle: response.has("favourites"),
      });
      const newNavMap = getFeatureSidebarItems();

      newNavMap.forEach((feature) => {
        if (hasAccesToFeature(feature.feature)) {
          const modules: ModuleWithPermissions[] = Modules.findByFeature(feature.feature);

          const permittedModules = modules.filter(
            (m) =>
              m.pageUrl && hasPermissionToModule({ module: m, action: Action.Read }) && t.has(`entities.${m.name}`),
          );

          if (permittedModules.length > 0) {
            const moduleUrls = permittedModules.map((m) => m.pageUrl).filter(Boolean) as string[];
            response.get("features")?.items.push({
              title: t(`feature-name`, { name: feature.name }),
              url: `/feature/${feature.name}`,
              icon: feature.icon,
              testId: `sidebar-${feature.name}-link`,
              activeUrls: [`/feature/${feature.name}`, ...moduleUrls],
              items: permittedModules.map((m) => ({
                title: t(`entities.${m.name}`, { count: 2 }),
                url: generateUrl({ page: m }),
                icon: m.icon,
                testId: `sidebar-${m.name}-link`,
              })),
            });
          }
        }
      });

      return response;
    } else {
      addSidebarItems(response, t, generateUrl, hasRole(RoleId.Administrator));
    }

    return response;
  }, [currentUser, company, recentPages, t, generateUrl, hasRole]);

  return (
    <Sidebar data-testid="sidebar-container" collapsible="icon" className="border-0 group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <Link href={generateUrl({ page: `/` })} className="mb-4 flex max-h-10 w-full items-center justify-center">
          <div className="flex w-full items-center justify-start gap-2 text-xl font-semibold">
            <Image src={`/logo.webp`} className="h-8 w-8 object-contain" height={32} width={32} alt={"Logo"} priority />
            <div className="flex flex-col">
              <span>{state === "expanded" && <>{company.name}</>}</span>
              <span className="text-muted-foreground text-xs font-light">
                {state === "expanded" && <>{t(`common.title`)}</>}
              </span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* <SidebarGroup className={`py-0 pb-1`}>
          <CreationDropDown />
        </SidebarGroup> */}
        {Array.from(navigationMap.entries())
          .filter(([groupLabel, items]) => items.items.length > 0)
          .map(([groupLabel, items]) => (
            <SidebarGroup key={groupLabel} className={`py-0 ${state === "collapsed" ? "pb-4" : "pb-1"}`}>
              {groupLabel !== "/" && state !== "collapsed" && items.hasTitle ? (
                <SidebarGroupLabel className="min-h-10 font-semibold">
                  {t(`common.sidebar`, { type: groupLabel })}
                </SidebarGroupLabel>
              ) : groupLabel !== "/" && !items.hasTitle ? (
                <div className="h-4"></div>
              ) : (
                <></>
              )}
              <SidebarMenu className="gap-0">
                {items.items.map((item: NavigationItem) => {
                  if (item.url && !hasPermissionToPath(item.url)) return null;
                  if (item.module && !hasPermissionToModule({ module: item.module, action: Action.Read })) return null;

                  const isDropdown = item.url === "#" && item.component;
                  const isItemActive = item.activeUrls
                    ? item.activeUrls.some((url) =>
                        url === "/" ? pathname.endsWith("/") : pathname.endsWith(url) || pathname.includes(url + "/"),
                      )
                    : false;

                  const hasSubItems = item.items && item.items.length > 0;

                  if (hasSubItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <HoverCard
                          open={openHoverCard === item.testId}
                          onOpenChange={(open) => setOpenHoverCard(open ? item.testId : null)}
                        >
                          <HoverCardTrigger render={<div />} delay={200} closeDelay={150}>
                            <SidebarMenuButton
                              render={<Link href={item.url} />}
                              isActive={isItemActive}
                              className="text-muted-foreground hover:bg-muted/50 cursor-pointer"
                              data-testid={item.testId}
                              tooltip={undefined}
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" sideOffset={8} align="start">
                            {state === "collapsed" && (
                              <div className="text-muted-foreground mb-1 px-2 text-[11px] font-semibold tracking-wider uppercase">
                                {item.title}
                              </div>
                            )}
                            <div className="flex flex-col">
                              {item.items.map((subItem) => (
                                <Link
                                  key={subItem.title}
                                  href={subItem.url}
                                  className="hover:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                                  data-testid={subItem.testId}
                                  onClick={() => setOpenHoverCard(null)}
                                >
                                  {subItem.icon && <subItem.icon className="text-muted-foreground h-4 w-4" />}
                                  <span>{subItem.title}</span>
                                </Link>
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title} className="">
                      {isDropdown ? (
                        <SidebarMenuButton
                          render={undefined}
                          className="text-muted-foreground"
                          data-testid={item.testId}
                          tooltip={item.title}
                        >
                          <item.icon />
                          {item.component}
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          render={<Link href={item.url} />}
                          isActive={isItemActive}
                          className="text-muted-foreground hover:bg-muted/50 cursor-pointer"
                          data-testid={item.testId}
                          tooltip={item.title}
                        >
                          <item.icon />
                          {item.component ? item.component : <span>{item.title}</span>}
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        {company && !company.isActiveSubscription && isStripeConfigured() && (
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
