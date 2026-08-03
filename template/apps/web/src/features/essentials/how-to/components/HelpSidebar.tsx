"use client";

import {
  Input,
  Link,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@carlonicora/nextjs-jsonapi/components";
import { HowToService } from "@carlonicora/nextjs-jsonapi";
import type { HowToInterface } from "@carlonicora/nextjs-jsonapi/core";
import { HELP_MODES } from "@carlonicora/nextjs-jsonapi/help/server";
import { UserSidebarFooter } from "@/features/common/components/navigations/UserSidebarFooter";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function HelpSidebar({ showUserFooter = false }: { showUserFooter?: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [articles, setArticles] = useState<HowToInterface[]>([]);
  const [query, setQuery] = useState("");
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    HowToService.findPublished().then((result) => {
      if (active) setArticles(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      [a.name, a.summary, ...(a.tags ?? [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [articles, query]);

  return (
    <Sidebar className="border-0 group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <Link href="/" className="mb-2 flex w-full items-center gap-2">
          <Image src="/logo.webp" className="h-8 w-8 object-contain" height={32} width={32} alt="Logo" priority />
          <span className="text-xl font-semibold">{t("common.title")}</span>
        </Link>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("help.sideNav.filterPlaceholder")}
        />
      </SidebarHeader>
      <SidebarContent>
        {HELP_MODES.map((mode) => {
          const items = filtered
            .filter((a) => a.howToType === mode)
            .sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={mode}>
              <SidebarGroupLabel>{t(`help.modes.${mode}`)}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((a) => {
                  const href = `/help/${a.howToType}/${a.slug}`;
                  return (
                    <SidebarMenuItem key={a.id}>
                      <SidebarMenuButton render={<Link href={href} />} isActive={pathname?.endsWith(href) ?? false}>
                        {a.name}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      {showUserFooter && (
        <SidebarFooter className="border-t">
          <UserSidebarFooter
            notificationModalOpen={notificationModalOpen}
            setNotificationModalOpen={setNotificationModalOpen}
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
