import { HelpSidebar } from "@/features/essentials/how-to/components/HelpSidebar";
import { SidebarSkeleton } from "@/features/common/components/skeletons/SidebarSkeleton";
import { OnboardingProviderWrapper } from "@/features/onboarding";
import { PushNotificationProvider, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
import {
  CurrentUserProvider,
  NotificationContextProvider,
  SessionProvider,
  SocketProvider,
} from "@carlonicora/nextjs-jsonapi/contexts";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { Suspense } from "react";

// Not async: the help pages are public and prerendered, so nothing on the path
// to {children} may await the session. The providers take it as a promise and
// stay inert for a visitor without one; the sidebar's user footer unwraps it
// behind its own boundary and renders only for a logged-in user.
export default function PublicHelpLayout({ children }: { children: React.ReactNode }) {
  const session = ServerSession.read();

  return (
    <SessionProvider session={session}>
      <SocketProvider session={session}>
        <OnboardingProviderWrapper>
          <CurrentUserProvider>
            <PushNotificationProvider>
              <NotificationContextProvider>
                <SidebarProvider>
                  <div className="bg-sidebar flex h-full min-h-screen w-full">
                    {/* Reads the pathname, which suspends during the shell prerender. */}
                    <Suspense fallback={<SidebarSkeleton />}>
                      <HelpSidebar />
                    </Suspense>
                    <div className="flex flex-1 flex-col">{children}</div>
                  </div>
                </SidebarProvider>
              </NotificationContextProvider>
            </PushNotificationProvider>
          </CurrentUserProvider>
        </OnboardingProviderWrapper>
      </SocketProvider>
    </SessionProvider>
  );
}
