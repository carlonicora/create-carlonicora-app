import { HELP_MODES } from "@carlonicora/nextjs-jsonapi/help/server";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { HelpPageChrome } from "@/features/essentials/how-to/components/HelpPageChrome";
import { HelpQuickLinks } from "@/features/essentials/how-to/components/HelpQuickLinks";
import { Link } from "@/i18n/navigation";
import { fetchPublicHowTos } from "./_data/publicHowTo";

// The articles are read at request time, after connection(), never during
// `next build`: a cached call that fails fails the prerender, so a build with no
// API reachable (Docker, CI) would break. The heading and the modes stay in the
// static shell; the read itself is still cached (publicHowTo.ts).
async function fetchFeaturedTutorials() {
  await connection();
  const tutorials = await fetchPublicHowTos({ howToType: "tutorial" });
  return tutorials.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 3);
}

async function FeaturedQuickLinks() {
  const t = await getTranslations();
  const featured = await fetchFeaturedTutorials();

  return (
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
}

async function FeaturedTutorials() {
  const t = await getTranslations();
  const featured = await fetchFeaturedTutorials();
  if (featured.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{t("help.landing.featuredTutorials")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((a) => (
          <li key={a.id}>
            <Link href={`/help/${a.howToType}/${a.slug}`} className="hover:bg-muted block rounded border p-4">
              <div className="font-medium">{a.name}</div>
              <div className="text-muted-foreground text-sm">{a.summary}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function HelpLandingPage() {
  const t = await getTranslations();

  return (
    <HelpPageChrome
      titleType={t("help.landing.heading")}
      breadcrumbs={[{ name: t("help.footerLink"), href: `/help` }]}
      details={
        <Suspense fallback={null}>
          <FeaturedQuickLinks />
        </Suspense>
      }
    >
      <div className="space-y-8">
        <p className="text-muted-foreground">{t("help.landing.subheading")}</p>

        <Suspense fallback={null}>
          <FeaturedTutorials />
        </Suspense>

        <section>
          <h2 className="mb-3 text-lg font-medium">{t("help.landing.browseByMode")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_MODES.map((m) => (
              <li key={m}>
                <Link href={`/help/${m}`} className="hover:bg-muted block rounded border p-4">
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
