import { generateSpecificMetadata } from "@/utils/metadata";
import { RbacByRoleContainer } from "@carlonicora/nextjs-jsonapi/components";
import { RbacProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { ModuleId, RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

const ROLE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(RoleId).map(([k, v]) => [v, k]),
);
const MODULE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(ModuleId).map(([k, v]) => [v, k]),
);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({
    title: t(`entities.rbac-by-role`, { count: 2 }),
  });
}

export default async function RbacByRolePage() {
  if (!(await ServerSession.hasRole(RoleId.Administrator))) {
    redirect("/");
  }

  return (
    <RbacProvider
      roleNames={ROLE_NAMES}
      moduleNames={MODULE_NAMES}
      outputPath="apps/api/src/rbac/permissions.ts"
    >
      <RbacByRoleContainer />
    </RbacProvider>
  );
}
