import { redirect } from "@/i18n/routing";

/**
 * `/settings/<segment>` → `/settings?section=<segment>`, preserving the query
 * string.
 *
 * This route exists for one caller: the package's TokenStatusIndicator hardcodes
 * `href="/settings/billing?action=subscribe"`. BillingDashboardContainer reads
 * `?action=subscribe` to auto-open the subscription wizard, so dropping the
 * query string here would silently land the user on the dashboard with no
 * wizard — the deep link would look like it worked and would not.
 */
export default async function SettingsModuleRedirect(props: {
  params: Promise<{ locale: string; module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, module } = await props.params;
  const searchParams = await props.searchParams;

  const forwarded = new URLSearchParams({ section: module });
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") forwarded.set(key, value);
    else if (Array.isArray(value) && value.length > 0) forwarded.set(key, value[0]);
  }

  redirect({ href: `/settings?${forwarded.toString()}`, locale });
}
