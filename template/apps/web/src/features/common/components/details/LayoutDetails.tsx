"use client";

import CommonSidebar from "@/features/common/components/navigations/CommonSidebar";
import { useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { RoleInterface, UserInterface } from "@carlonicora/nextjs-jsonapi/features";
import { useNotificationSync, usePageTracker } from "@carlonicora/nextjs-jsonapi/hooks";
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
    <div data-wrapper className="flex h-full w-full">
      <CommonSidebar />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
