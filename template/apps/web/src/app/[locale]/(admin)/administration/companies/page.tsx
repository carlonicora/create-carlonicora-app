import { generateSpecificMetadata } from "@/utils/metadata";
import { CompaniesList, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CompanyProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({
    title: t(`types.companies`, { count: 2 }),
  });
}

export default async function CompaniesListPage() {
  return (
    <CompanyProvider>
      <PageContainer>
        <CompaniesList />
      </PageContainer>
    </CompanyProvider>
  );
}
