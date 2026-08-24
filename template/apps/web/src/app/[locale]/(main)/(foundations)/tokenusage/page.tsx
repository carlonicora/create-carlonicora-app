import { generateSpecificMetadata } from "@/utils/metadata";
import { TokenUsageReportContainer, TokenUsageReportProvider } from "@carlonicora/nextjs-jsonapi/tokenusage";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Self-service token-usage dashboard. The dashboard itself lives in
 * @carlonicora/nextjs-jsonapi's tokenusage feature; this route only composes it.
 *
 * Import from the CLIENT subpath. The package deliberately ships NO server
 * entry for this feature: tsup only stamps "use client" on the entries in its
 * clientEntries, and with splitting:true a package-side server page puts the
 * provider and container in a directive-less shared chunk — Next then treats
 * them as Server Components and every createContext in the transitive graph
 * fails to compile.
 *
 * No `targetLabel` is passed: the "by target" panel groups usage by an
 * application-specific Neo4j label, and the API refuses any label this app's
 * TokenUsageTargetsModule did not declare. This app declares none, so the panel
 * is skipped rather than rendered empty, and no request is issued for it. Pass
 * `targetLabel` together with `targetPanelTitleKey` once your app attributes
 * usage to one of its own entities.
 *
 * `TokenUsageReportContainer` also takes an optional `balances` prop for the
 * remaining-credits tiles. Those values come from useCurrentUserContext(), a
 * client hook this server route cannot call — supply them by wrapping the
 * container in a small "use client" bridge of your own.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`token_usage.report.title`) });
}

export default async function TokenUsagePage() {
  return (
    <TokenUsageReportProvider>
      <TokenUsageReportContainer />
    </TokenUsageReportProvider>
  );
}
