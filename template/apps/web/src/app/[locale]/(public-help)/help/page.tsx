import { HELP_MODES } from "@carlonicora/nextjs-jsonapi/help/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { HelpPageChrome } from "@/features/essentials/how-to/components/HelpPageChrome";
import { HelpQuickLinks } from "@/features/essentials/how-to/components/HelpQuickLinks";
import { fetchPublicHowTos } from "./_data/publicHowTo";

export const revalidate = 3600;

export default async function HelpLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations();

  const tutorials = (await fetchPublicHowTos({ howToType: "tutorial" })).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const featured = tutorials.slice(0, 3);

  const details = (
    <HelpQuickLinks
      heading={t("help.landing.featuredTutorials")}
      items={featured.map((a) => ({
        id: a.id,
        name: a.name,
        summary: a.summary,
        howToType: a.howToType ?? "tutorial",
        slug: a.slug ?? "",
      }))}
    />
  );

  return (
    <HelpPageChrome
      titleType={t("help.landing.heading")}
      breadcrumbs={[{ name: t("help.footerLink"), href: `/${locale}/help` }]}
      details={details}
    >
      <div className="space-y-8">
        <p className="text-muted-foreground">{t("help.landing.subheading")}</p>

        {featured.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-medium">{t("help.landing.featuredTutorials")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/${locale}/help/${a.howToType}/${a.slug}`}
                    className="hover:bg-muted block rounded border p-4"
                  >
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-sm">{a.summary}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-medium">{t("help.landing.browseByMode")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_MODES.map((m) => (
              <li key={m}>
                <Link href={`/${locale}/help/${m}`} className="hover:bg-muted block rounded border p-4">
                  <div className="font-medium">{t(`help.modes.${m}`)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </HelpPageChrome>
  );
}
