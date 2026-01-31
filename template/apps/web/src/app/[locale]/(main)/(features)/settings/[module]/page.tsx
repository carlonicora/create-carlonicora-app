import SettingsContainer from "@/features/common/components/containers/SettingsContainer";
import { SettingsProvider } from "@/features/common/contexts/SettingsContext";
import { generateSpecificMetadata } from "@/utils/metadata";
import { PageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  const title = t(`common.settings`);

  return await generateSpecificMetadata({ title: title });
}

export default async function SettingsPage(props: { params: Promise<{ module: string }> }) {
  const { module } = await props.params;

  return (
    <SettingsProvider moduleName={module}>
      <PageContainer>
        <SettingsContainer />
      </PageContainer>
    </SettingsProvider>
  );
}
