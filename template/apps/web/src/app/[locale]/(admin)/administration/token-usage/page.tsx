import { requireAdministrator } from "@/features/common/components/session/requireAdministrator";
import { generateSpecificMetadata } from "@/utils/metadata";
import { AdministrationProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { TokenUsageAdminContainer, TokenUsageAdminProvider } from "@carlonicora/nextjs-jsonapi/tokenusage";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * The dashboard lives in the package's tokenusage feature; this route only
 * composes it.
 *
 * Import from the CLIENT subpath. The package deliberately ships no server
 * entry for this feature: tsup only stamps "use client" on the entries listed
 * in clientEntries, and with splitting:true a package-side server page puts the
 * provider and container into a directive-less shared chunk — Next then treats
 * them as Server Components and every createContext in the package's transitive
 * graph fails to compile.
 *
 * requireAdministrator() below is the only gate: the (admin) layout no longer
 * reads the session.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`token_usage.admin.title`) });
}

export default async function AdministrationTokenUsagePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireAdministrator(locale);

  return (
    <AdministrationProvider>
      <TokenUsageAdminProvider>
        {/* TokenUsageAdminContainer brings its own RoundPageContainer and reads
            its title from SharedContext, which AdministrationProvider supplies. */}
        <TokenUsageAdminContainer />
      </TokenUsageAdminProvider>
    </AdministrationProvider>
  );
}
