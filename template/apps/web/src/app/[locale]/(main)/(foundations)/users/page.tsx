import { PageContainer, UsersListContainer } from "@carlonicora/nextjs-jsonapi/components";
import { UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Modules } from "@carlonicora/nextjs-jsonapi/core";
import { Action } from "@carlonicora/nextjs-jsonapi/permissions";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";

export default async function UsersListPage() {
  ServerSession.checkPermission({ module: Modules.User, action: Action.Read });

  return (
    <UserProvider>
      <PageContainer testId="page-users-container">
        <UsersListContainer />
      </PageContainer>
    </UserProvider>
  );
}
