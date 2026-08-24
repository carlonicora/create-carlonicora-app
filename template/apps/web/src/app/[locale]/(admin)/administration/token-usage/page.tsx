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
 * The (admin) layout already returns 403 for anyone without the Administrator
 * role, so this route carries no auth code of its own.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`token_usage.admin.title`) });
}

export default async function AdministrationTokenUsagePage() {
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
