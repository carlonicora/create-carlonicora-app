import { OnboardingProviderWrapper } from "@/features/onboarding";
import { HelpSidebar } from "@/features/essentials/how-to/components/HelpSidebar";
import { PushNotificationProvider, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
import { CurrentUserProvider, NotificationContextProvider, SocketProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { cookies } from "next/headers";

export default async function PublicHelpLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const isLogged = await ServerSession.isLogged();

  const shell = (showUserFooter: boolean) => (
    <SidebarProvider>
      <div className="bg-sidebar flex h-full min-h-screen w-full">
        <HelpSidebar showUserFooter={showUserFooter} />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  );

  if (!isLogged) {
    return <CurrentUserProvider>{shell(false)}</CurrentUserProvider>;
  }

  return (
    <SocketProvider token={token}>
      <OnboardingProviderWrapper>
        <CurrentUserProvider>
          <PushNotificationProvider>
            <NotificationContextProvider>{shell(true)}</NotificationContextProvider>
          </PushNotificationProvider>
        </CurrentUserProvider>
      </OnboardingProviderWrapper>
    </SocketProvider>
  );
}
