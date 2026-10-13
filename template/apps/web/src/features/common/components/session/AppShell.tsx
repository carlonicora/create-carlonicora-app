import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";

import LayoutDetails from "@/features/common/components/details/LayoutDetails";
import { OnboardingProviderWrapper } from "@/features/onboarding";
import { PushNotificationProvider, RefreshUser, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
import {
  CurrentUserProvider,
  NotificationContextProvider,
  SessionProvider,
  SocketProvider,
  ViewportProvider,
} from "@carlonicora/nextjs-jsonapi/contexts";

// Not async, and must stay that way: nothing on the path from the layout to
// {children} may await. The session is read once as a promise and handed to the
// providers; only leaves behind their own <Suspense> unwrap it.
export function AppShell({ children }: { children: React.ReactNode }) {
  const session = ServerSession.read();

  return (
    <SessionProvider session={session}>
      <ViewportProvider session={session}>
        <SocketProvider session={session}>
          <CurrentUserProvider>
            <OnboardingProviderWrapper>
              <PushNotificationProvider>
                <NotificationContextProvider>
                  <SidebarProvider session={session}>
                    <RefreshUser />
                    {/* TrialBlockingWrapper lives inside LayoutDetails, around the
                        content column only, so its overlay never hides the frame. */}
                    <LayoutDetails>{children}</LayoutDetails>
                  </SidebarProvider>
                </NotificationContextProvider>
              </PushNotificationProvider>
            </OnboardingProviderWrapper>
          </CurrentUserProvider>
        </SocketProvider>
      </ViewportProvider>
    </SessionProvider>
  );
}
