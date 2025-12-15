import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import "react-horizontal-scrolling-menu/dist/styles.css";

import LayoutDetails from "@/features/common/components/details/LayoutDetails";
import { routing } from "@/i18n/routing";
import { PushNotificationProvider, RefreshUser, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
import { NotificationContextProvider, SocketProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "../../globals.css";

const fontSans = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "700"], variable: "--font-sans" });

export default async function AdminLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;
  const { children } = props;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  setRequestLocale(locale);
  const messages = await getMessages();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  if (await ServerSession.isLogged())
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

  return <div className="flex min-h-screen w-full flex-col items-center justify-center">{children}</div>;
}
