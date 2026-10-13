import { SessionFallback } from "@/features/common/components/session/SessionFallback";
import { CurrentUserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Suspense } from "react";

export default async function MainLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { children } = props;

  // CurrentUserProvider reads usePathname, which suspends on the [code] routes
  // while they prerender: the boundary keeps that out of the shell above it.
  return (
    <Suspense fallback={<SessionFallback />}>
      <CurrentUserProvider>
        <div data-wrapper className="flex h-svh w-full items-center justify-center">
          {children}
        </div>
      </CurrentUserProvider>
    </Suspense>
  );
}
