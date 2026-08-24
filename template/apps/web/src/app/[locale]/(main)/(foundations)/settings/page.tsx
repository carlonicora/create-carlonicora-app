import SettingsContainer from "@/features/common/components/containers/SettingsContainer";
import { PROFILE_SECTION } from "@/features/common/components/containers/UserProfileContainer";
import { generateSpecificMetadata } from "@/utils/metadata";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`common.settings`) });
}

export default async function SettingsPage(props: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await props.searchParams;

  return <SettingsContainer initialSection={section ?? PROFILE_SECTION} />;
}
