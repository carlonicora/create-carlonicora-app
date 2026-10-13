import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { RbacByRoleContainer } from "@carlonicora/nextjs-jsonapi/components";
import { RbacProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { ModuleId, RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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

export default async function RbacByRolePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

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
