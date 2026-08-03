"use client";

import VersionDisplay from "@/features/common/components/navigations/VersionDisplay";
import AppHowToCommand from "@/features/essentials/how-to/components/AppHowToCommand";
import { OnboardingTrigger } from "@/features/onboarding";
import { usePathname, useRouter } from "@/i18n/routing";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Link,
  ModeToggleSwitch,
  NotificationModal,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  UserAvatar,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/components";
import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { Modules, UserInterface } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { ChevronsUpDown, HelpCircleIcon, LogOut, SettingsIcon, Shield, UserIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type UserSidebarFooterProps = {
  notificationModalOpen: boolean;
  setNotificationModalOpen: (open: boolean) => void;
};

export function UserSidebarFooter({ notificationModalOpen, setNotificationModalOpen }: UserSidebarFooterProps) {
  const { currentUser, hasRole } = useCurrentUserContext<UserInterface>();
  const { isMobile } = useSidebar();
  const generateUrl = usePageUrlGenerator();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  const availableLanguages = t.raw("common.languages" as any) as Record<string, string>;

  const switchLanguage = (locale: string) => {
    if (locale !== currentLocale) {
      router.replace(pathname, { locale });
    }
  };

  const logOut = async () => {
    window.location.href = generateUrl({ page: `/logout` });
  };

  return (
    <SidebarMenu>
      <AppHowToCommand />
      <OnboardingTrigger />
      {currentUser && !hasRole(RoleId.Administrator) && (
        <SidebarMenuItem>
          <NotificationModal isOpen={notificationModalOpen} setIsOpen={setNotificationModalOpen} />
        </SidebarMenuItem>
      )}
      {(hasRole(RoleId.CompanyAdministrator) || hasRole(RoleId.Administrator)) && (
        <Link href={generateUrl({ page: `/settings` })}>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground">
              <SettingsIcon />
              {t(`common.settings`)}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </Link>
      )}
      <SidebarMenuItem className="-ml-0.5 w-full">
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger className={`w-full`}>
              <SidebarMenuButton
                render={<div />}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <UserAvatar user={currentUser} className="h-5 w-5" showTooltip={false} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{currentUser.name}</span>
                  <span className="truncate text-xs">{currentUser.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{currentUser.name}</span>
                      <span className="truncate text-xs">{currentUser.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <VersionDisplay />
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <ModeToggleSwitch />
                  {t(`common.theme`)}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t(`common.language`)}</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {Object.entries(availableLanguages).map(([locale, label]) => (
                        <DropdownMenuItem
                          key={locale}
                          onClick={() => switchLanguage(locale)}
                          className="cursor-pointer"
                        >
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href={generateUrl({ page: Modules.User, id: currentUser.id })}>
                  <DropdownMenuItem>
                    <UserIcon />
                    {t(`common.my_profile`)}
                  </DropdownMenuItem>
                </Link>
                <Link href={generateUrl({ page: "/settings" })}>
                  <DropdownMenuItem>
                    <Shield />
                    {t("common.account_settings")}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href={generateUrl({ page: `/help` })}>
                  <DropdownMenuItem>
                    <HelpCircleIcon />
                    {t(`help.footerLink`)}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={logOut}>
                  <LogOut />
                  {t(`auth.buttons.logout`)}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
