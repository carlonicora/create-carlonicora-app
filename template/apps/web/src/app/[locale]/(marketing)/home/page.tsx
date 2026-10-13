import { generateSpecificMetadata } from "@/utils/metadata";
import { AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CurrentUserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/core";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// The path is passed, so the metadata never reads the request headers and the page stays static.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`common.home`), path: "/" });
}

/**
 * The landing for visitors without a session. proxy.ts rewrites `/` here when
 * there is no session, so the URL stays `/`. Replace it with your marketing page.
 */
export default function HomePage() {
  return (
    <CurrentUserProvider>
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <AuthContainer componentType={AuthComponent.Landing} />
      </div>
    </CurrentUserProvider>
  );
}
