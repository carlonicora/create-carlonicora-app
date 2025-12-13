import { PageContainer, RoleContainer } from "@carlonicora/nextjs-jsonapi/components";
import { RoleProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Modules } from "@carlonicora/nextjs-jsonapi/core";
import { RoleInterface, RoleService } from "@carlonicora/nextjs-jsonapi/features";
import { Action } from "@carlonicora/nextjs-jsonapi/permissions";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";

export default async function RolePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const role: RoleInterface = await RoleService.findById({
    roleId: params.id,
  });

  ServerSession.checkPermission({ module: Modules.Role, action: Action.Read, data: role });

  return (
    <RoleProvider dehydratedRole={role.dehydrate()}>
      <PageContainer>
        <RoleContainer />
      </PageContainer>
    </RoleProvider>
  );
}
