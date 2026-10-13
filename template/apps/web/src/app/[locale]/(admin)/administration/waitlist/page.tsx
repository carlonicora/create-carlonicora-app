import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { PageContainer, WaitlistList } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({
    title: t("waitlist.admin.title"),
    description: t("waitlist.admin.description"),
  });
}

export default async function WaitlistAdminPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

  return (
    <PageContainer className="pr-4">
      <WaitlistList />
    </PageContainer>
  );
}
