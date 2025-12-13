import { BootstrapProvider } from "@/config/BootstrapProvider";
import "@/config/env"; // Server-side bootstrap
import { CurrentUserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Provider } from "jotai";
import "react-horizontal-scrolling-menu/dist/styles.css";

import { routing } from "@/i18n/routing";
// import { cn } from "@/lib/utils";
import { TooltipProvider } from "@carlonicora/nextjs-jsonapi/shadcnui";
import { cn } from "@carlonicora/nextjs-jsonapi/utils";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import "../globals.css";

const fontSans = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "700"], variable: "--font-sans" });

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
                <CurrentUserProvider>
                  <TooltipProvider>
                    <Toaster closeButton richColors />
                    {children}
                  </TooltipProvider>
                </CurrentUserProvider>
              </BootstrapProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </Provider>
      </body>
    </html>
  );
}
