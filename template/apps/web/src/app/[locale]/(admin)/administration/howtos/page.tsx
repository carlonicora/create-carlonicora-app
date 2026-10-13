import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { HowToListContainer } from "@carlonicora/nextjs-jsonapi/components";
import { HowToProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const title = t(`entities.howtos`, { count: 2 });
  return await generateSpecificMetadata({ title: title });
}

export default async function HowTosListPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

  return (
    <HowToProvider>
      <HowToListContainer />
    </HowToProvider>
  );
}
