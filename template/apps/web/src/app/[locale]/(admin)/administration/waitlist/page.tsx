import { generateSpecificMetadata } from "@/utils/metadata";
import { PageContainer, WaitlistList } from "@carlonicora/nextjs-jsonapi/components";
import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { RoleId } from "@{{name}}/shared";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({
    title: t("waitlist.admin.title"),
    description: t("waitlist.admin.description"),
  });
}

export default async function WaitlistAdminPage() {
  if (!(await ServerSession.hasRole(RoleId.Administrator))) {
    redirect("/");
  }

  return (
    <PageContainer className="pr-4">
      <WaitlistList />
    </PageContainer>
  );
}
