"use client";

import { TrialExpiringBanner } from "@/features/common/components/banners/TrialExpiringBanner";
import CommonSidebar from "@/features/common/components/navigations/CommonSidebar";
import QuickCreateMenu from "@/features/common/components/navigations/QuickCreateMenu";
import { useNotificationSync, usePageTracker } from "@carlonicora/nextjs-jsonapi/client";
import { HeaderLeftContentProvider, useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { RoleInterface, UserInterface } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { useEffect } from "react";

type LayoutDetailsProps = { children: React.ReactNode };

export default function LayoutDetails({ children }: LayoutDetailsProps) {
  // Notification functionality enabled

  const { currentUser } = useCurrentUserContext<UserInterface>();
  const { loadNotifications } = useNotificationContext();

  useNotificationSync();
  usePageTracker();

  useEffect(() => {
    if (currentUser && !currentUser.roles?.find((role: RoleInterface) => role.id === RoleId.Administrator)) {
      loadNotifications();
    }
  }, [currentUser, loadNotifications]);

  return (
    <div data-wrapper className="bg-sidebar flex h-full w-full">
      <CommonSidebar />
      <HeaderLeftContentProvider content={<QuickCreateMenu />}>
        <div className="flex flex-1 flex-col">
          <TrialExpiringBanner />
          {children}
        </div>
      </HeaderLeftContentProvider>
    </div>
  );
}
