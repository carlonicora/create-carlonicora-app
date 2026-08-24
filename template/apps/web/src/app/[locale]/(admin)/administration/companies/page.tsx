// Import env first to ensure bootstrap() runs before any Modules access
import { generateSpecificMetadata } from "@/utils/metadata";
import { CompaniesListContainer } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({
    title: t(`entities.companies`, { count: 2 }),
  });
}

/**
 * The container owns CompanyProvider and the page shell. It has to: a Server
 * Component cannot pass `Modules.Company` to a client component — the registry
 * entry carries an icon component and methods.
 */
export default async function CompaniesListPage() {
  return <CompaniesListContainer />;
}
