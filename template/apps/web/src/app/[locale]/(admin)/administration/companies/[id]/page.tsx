import { generateSpecificMetadata } from "@/utils/metadata";
import { AdminCompanyContainer, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CompanyProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Modules } from "@carlonicora/nextjs-jsonapi/core";
import { CompanyInterface, CompanyService } from "@carlonicora/nextjs-jsonapi/features";
import { Action } from "@carlonicora/nextjs-jsonapi/permissions";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

const getCachedCompany = cache(async (id: string) => CompanyService.findOne({ companyId: id }));

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();

  const company: CompanyInterface = await getCachedCompany(params.id);

  const title = (await ServerSession.hasPermissionToModule({
    module: Modules.Company,
    action: Action.Read,
    data: company,
  }))
    ? `[${t(`types.companies`, { count: 1 })}] ${company.name}`
    : `${t(`types.companies`, { count: 1 })}`;

  return await generateSpecificMetadata({ title: title });
}

export default async function CompanyPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const company: CompanyInterface = await getCachedCompany(params.id);

  if (!(await ServerSession.hasRole(RoleId.Administrator)))
    ServerSession.checkPermission({ module: Modules.Company, action: Action.Read, data: company });

  return (
    <CompanyProvider dehydratedCompany={company.dehydrate()}>
      <PageContainer>
        <AdminCompanyContainer />
      </PageContainer>
    </CompanyProvider>
  );
}
