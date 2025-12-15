import { PageContainer, UsersListContainer } from "@carlonicora/nextjs-jsonapi/components";
import { UserProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Action, Modules } from "@carlonicora/nextjs-jsonapi/core";
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
