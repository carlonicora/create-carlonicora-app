"use client";

import { TrialExpiringBanner } from "@/features/common/components/banners/TrialExpiringBanner";
import QuickCreateMenu from "@/features/common/components/navigations/QuickCreateMenu";
import { AppSidebar } from "@/features/common/components/session/AppSidebar";
import { SidebarSkeleton } from "@/features/common/components/skeletons/SidebarSkeleton";
import { TrialBlockingWrapper } from "@/features/common/components/wrappers/TrialBlockingWrapper";
import { useNotificationSync, usePageTracker } from "@carlonicora/nextjs-jsonapi/client";
import { HeaderLeftContentProvider, useCurrentUserContext, useNotificationContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { RoleInterface, UserInterface } from "@carlonicora/nextjs-jsonapi/core";
import { RoleId } from "@{{name}}/shared";
import { Suspense, useEffect } from "react";

type LayoutDetailsProps = { children: React.ReactNode };

// usePageTracker reads the pathname, which suspends during the shell prerender.
// It lives in its own leaf behind its own boundary so the frame and {children}
// are never held behind it.
function PageTracker() {
  usePageTracker();
  return null;
}

export default function LayoutDetails({ children }: LayoutDetailsProps) {
  // Notification functionality enabled

  const { currentUser } = useCurrentUserContext<UserInterface>();
  const { loadNotifications } = useNotificationContext();

  useNotificationSync();

  useEffect(() => {
    if (currentUser && !currentUser.roles?.find((role: RoleInterface) => role.id === RoleId.Administrator)) {
      loadNotifications();
    }
  }, [currentUser, loadNotifications]);

  return (
    <div data-wrapper className="bg-sidebar flex h-full w-full">
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <HeaderLeftContentProvider content={<QuickCreateMenu />}>
        <div className="flex flex-1 flex-col">
          <TrialExpiringBanner />
          {/* Covers only this column while the subscription status loads or
              blocks, so the sidebar skeleton shows on a cold load. */}
          <TrialBlockingWrapper>{children}</TrialBlockingWrapper>
        </div>
      </HeaderLeftContentProvider>
    </div>
  );
}
