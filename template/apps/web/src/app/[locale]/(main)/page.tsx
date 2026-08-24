import IndexContainer from "@/features/common/components/containers/IndexContainer";
import { generateSpecificMetadata } from "@/utils/metadata";
import { AdminIndexContainer, AuthContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CommonProvider, CompanyProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { AuthComponent } from "@carlonicora/nextjs-jsonapi/core";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`common.home`) });
}

export default async function IndexPage() {
  if (!(await ServerSession.isLogged())) return <AuthContainer componentType={AuthComponent.Landing} />;

  if (await ServerSession.hasRole(RoleId.Administrator)) {
    return (
      <CompanyProvider>
        <CommonProvider>
          <AdminIndexContainer />
        </CommonProvider>
      </CompanyProvider>
    );
  }

  return (
    <CommonProvider>
      <IndexContainer />
    </CommonProvider>
  );
}
