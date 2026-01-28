import { BootstrapProvider } from "@/config/BootstrapProvider";
import "@/config/env"; // Server-side bootstrap
import { PWAProvider } from "@/features/pwa/components";
import { Toaster, TooltipProvider } from "@carlonicora/nextjs-jsonapi/components";
import { cn } from "@carlonicora/nextjs-jsonapi/core";
import { Provider } from "jotai";
import "react-horizontal-scrolling-menu/dist/styles.css";

import { routing } from "@/i18n/routing";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import type { Viewport, Metadata } from "next";

const fontSans = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "700"], variable: "--font-sans" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "{{name}}",
    startupImage: [
      {
        url: "/splash/apple-splash-640x1136.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-750x1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash/apple-splash-1242x2208.png",
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/apple-splash-1125x2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash/apple-splash-1284x2778.png",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  icons: {
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;
  const { children } = props;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html suppressHydrationWarning lang={locale}>
      <body className={cn("bg-background top-0! min-h-screen font-sans antialiased", fontSans.variable)}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <NextIntlClientProvider messages={messages}>
              <BootstrapProvider>
                <TooltipProvider>
                  <Toaster closeButton />
                  <PWAProvider>
                    {children}
                  </PWAProvider>
                </TooltipProvider>
              </BootstrapProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
