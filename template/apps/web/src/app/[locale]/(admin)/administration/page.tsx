import { generateSpecificMetadata } from "@/utils/metadata";
import { AdminIndexContainer } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`administration.title`) });
}

/**
 * AdminIndexContainer brings its own RoundPageContainer shell (header
 * included), so this route must NOT wrap it in PageContainer — two shells
 * render two headers.
 */
export default async function AdministrationPage() {
  return <AdminIndexContainer />;
}
