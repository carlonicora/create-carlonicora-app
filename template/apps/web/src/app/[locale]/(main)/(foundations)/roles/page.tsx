import { PageContainer, RolesList } from "@carlonicora/nextjs-jsonapi/components";
import { RoleProvider } from "@carlonicora/nextjs-jsonapi/contexts";

export default async function RolesListPage() {
  return (
    <RoleProvider>
      <PageContainer>
        <RolesList />
      </PageContainer>
    </RoleProvider>
  );
}
