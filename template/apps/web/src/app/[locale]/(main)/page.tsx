import IndexContainer from "@/features/common/components/containers/IndexContainer";
import { generateSpecificMetadata } from "@/utils/metadata";
import { AuthComponent, AuthContainer, CompaniesList, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CommonProvider, CompanyProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { ContentInterface, ContentService } from "@carlonicora/nextjs-jsonapi/core";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`generic.home`) });
}

export default async function IndexPage() {
  if (!(await ServerSession.isLogged())) return <AuthContainer componentType={AuthComponent.Landing} />;

  if (await ServerSession.hasRole(RoleId.Administrator)) {
    return (
      <CompanyProvider>
        <CommonProvider>
          <PageContainer>
            <CompaniesList />
          </PageContainer>
        </CommonProvider>
      </CompanyProvider>
    );
  }

  const contentList: ContentInterface[] = await ContentService.findMany({});

  return (
    <CommonProvider>
      <PageContainer testId="page-homepage-container">
        <IndexContainer dehydratedContentList={contentList ? contentList.map((content) => content.dehydrate()) : []} />
      </PageContainer>
    </CommonProvider>
  );
}
