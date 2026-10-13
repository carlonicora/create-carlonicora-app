import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
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
export default async function AdministrationPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

  return <AdminIndexContainer />;
}
