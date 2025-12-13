import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import "react-horizontal-scrolling-menu/dist/styles.css";

import LayoutDetails from "@/features/common/components/details/LayoutDetails";
import { AuthContainer, PushNotificationProvider, RefreshUser } from "@carlonicora/nextjs-jsonapi/components";
import { NotificationContextProvider, SocketProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/features";
import { SidebarProvider } from "@carlonicora/nextjs-jsonapi/shadcnui";
import { cookies } from "next/headers";

export default async function MainLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { children } = props;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  if (!(await ServerSession.isLogged()))
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <AuthContainer componentType={AuthComponent.Landing} />
      </div>
    );

  // if (await ServerSession.isLicenseActive())
  return (
    <SocketProvider token={token}>
      <PushNotificationProvider>
        <NotificationContextProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <RefreshUser />
            <LayoutDetails>{children}</LayoutDetails>
          </SidebarProvider>
        </NotificationContextProvider>
      </PushNotificationProvider>
    </SocketProvider>
  );

  // return <CompanyLicense />;
}
