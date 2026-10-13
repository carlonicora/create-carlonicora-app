import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { PlatformUsersContainer } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`entities.users`, { count: 2 }) });
}

/**
 * PlatformUsersContainer lists users across ALL companies (`GET /users`, which
 * widens for administrators) with a Company column. The company-scoped
 * AllUsersListContainer would render an empty table here: it resolves the
 * current user's company, and a system administrator has none.
 */
export default async function AdministrationUsersPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

  return <PlatformUsersContainer />;
}
