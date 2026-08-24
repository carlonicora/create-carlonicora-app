// Import env first to ensure bootstrap() runs before any Modules access
import { generateSpecificMetadata } from "@/utils/metadata";
import { AdminCompanyContainer, RoundPageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CompanyProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { CompanyInterface, Modules } from "@carlonicora/nextjs-jsonapi/core";
import { Action } from "@carlonicora/nextjs-jsonapi";
import { ServerCompanyService, ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

const getCachedCompany = cache(async (id: string) => ServerCompanyService.findOne({ companyId: id }));

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();

  const company: CompanyInterface = await getCachedCompany(params.id);

  const title = (await ServerSession.hasPermissionToModule({
    module: Modules.Company,
    action: Action.Read,
    data: company,
  }))
    ? `[${t(`entities.companies`, { count: 1 })}] ${company.name}`
    : `${t(`entities.companies`, { count: 1 })}`;

  return await generateSpecificMetadata({ title: title });
}

export default async function CompanyPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const company: CompanyInterface = await getCachedCompany(params.id);

  if (!(await ServerSession.hasRole(RoleId.Administrator)))
    // `await` restored after adoption: ServerSession.checkPermission is async and
    // redirects to /401 internally, so an un-awaited call lets the page render its
    // JSX before the redirect is raised.
    await ServerSession.checkPermission({ module: Modules.Company, action: Action.Read, data: company });

  return (
    <CompanyProvider dehydratedCompany={company.dehydrate()}>
      {/* No AdministrationProvider here: CompanyProvider already feeds the page
          chrome, and on a company detail page the title must be the company. */}
      <RoundPageContainer>
        <AdminCompanyContainer />
      </RoundPageContainer>
    </CompanyProvider>
  );
}
