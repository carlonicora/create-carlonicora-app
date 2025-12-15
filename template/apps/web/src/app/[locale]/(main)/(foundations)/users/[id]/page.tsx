import { generateSpecificMetadata } from "@/utils/metadata";
import { PageContainer, UserContainer } from "@carlonicora/nextjs-jsonapi/components";
import { CompanyProvider, UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Action, Modules, UserInterface, UserService } from "@carlonicora/nextjs-jsonapi/core";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

const getCachedUser = cache(async (id: string) => UserService.findById({ userId: id }));

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations();

  let title = `${t(`types.users`, { count: 1 })}`;

  const user: UserInterface = (await getCachedUser(params.id)) as UserInterface;

  if (await ServerSession.hasPermissionToModule({ module: Modules.User, action: Action.Read, data: user }))
    title = `[${t(`types.users`, { count: 1 })}] ${user.name}`;

  return await generateSpecificMetadata({ title: title });
}

export default async function UserPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const params = await props.params;

  const user: UserInterface = await getCachedUser(params.id);

  return (
    <CompanyProvider dehydratedCompany={user.company?.dehydrate()}>
      <UserProvider dehydratedUser={user.dehydrate()}>
        <PageContainer>
          <UserContainer />
        </PageContainer>
      </UserProvider>
    </CompanyProvider>
  );
}
