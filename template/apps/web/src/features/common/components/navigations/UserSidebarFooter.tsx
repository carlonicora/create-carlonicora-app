"use client";

import VersionDisplay from "@/features/common/components/navigations/VersionDisplay";
import { Modules } from "@carlonicora/nextjs-jsonapi";
import { usePageUrlGenerator } from "@carlonicora/nextjs-jsonapi/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { UserInterface } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { ChevronsUpDown, LogOut, SettingsIcon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type UserSidebarFooterProps = {
  notificationModalOpen: boolean;
  setNotificationModalOpen: (open: boolean) => void;
};

export function UserSidebarFooter({ notificationModalOpen, setNotificationModalOpen }: UserSidebarFooterProps) {
  const { currentUser, hasRole } = useCurrentUserContext<UserInterface>();
  const { isMobile } = useSidebar();
  const generateUrl = usePageUrlGenerator();
  const t = useTranslations();

  const logOut = async () => {
    window.location.href = generateUrl({ page: `/logout` });
  };

  return (
    <SidebarMenu>
      {currentUser && !hasRole(RoleId.Administrator) && (
        <SidebarMenuItem>
          <NotificationModal isOpen={notificationModalOpen} setIsOpen={setNotificationModalOpen} />
        </SidebarMenuItem>
      )}
      {hasRole(RoleId.CompanyAdministrator) && (
        <Link href={generateUrl({ page: `/settings` })}>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-muted-foreground">
              <SettingsIcon />
              {t(`generic.settings`)}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </Link>
      )}
      <SidebarMenuItem className="-ml-0.5">
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <UserAvatar user={currentUser} className="h-5 w-5" />
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
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{currentUser.name}</span>
                    <span className="truncate text-xs">{currentUser.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                <VersionDisplay />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                <ModeToggleSwitch />
                {t(`generic.theme`)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href={generateUrl({ page: Modules.User, id: currentUser.id })}>
                  <DropdownMenuItem>
                    <UserIcon />
                    {t(`generic.my_profile`)}
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logOut}>
                <LogOut />
                {t(`foundations.auth.buttons.logout`)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
