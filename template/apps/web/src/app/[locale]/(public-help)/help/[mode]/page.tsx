import { HELP_MODES, type HelpMode } from "@carlonicora/nextjs-jsonapi/help/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HelpPageChrome } from "@/features/essentials/how-to/components/HelpPageChrome";
import { Link } from "@/i18n/navigation";
import { fetchPublicHowTos } from "../_data/publicHowTo";

// Every mode is known at build time, so each mode index is prerendered.
export function generateStaticParams() {
  return HELP_MODES.map((mode) => ({ mode }));
}

// Read at request time, after connection(), never during `next build`: the build
// may run with no API reachable, and a failing cached call fails the prerender.
async function ModeArticles({ mode }: { mode: HelpMode }) {
  await connection();
  const t = await getTranslations();
  const articles = (await fetchPublicHowTos({ howToType: mode })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (articles.length === 0) return <p className="text-muted-foreground">{t("help.modeIndex.empty")}</p>;

  return (
    <ul className="space-y-2">
      {articles.map((a) => (
        <li key={a.id}>
          <Link href={`/help/${a.howToType}/${a.slug}`} className="hover:bg-muted block rounded border p-3">
            <div className="font-medium">{a.name}</div>
            <div className="text-muted-foreground text-sm">{a.summary}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function HelpModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!(HELP_MODES as readonly string[]).includes(mode)) notFound();
  const t = await getTranslations();

  return (
    <HelpPageChrome
      titleType={t(`help.modes.${mode}`)}
      breadcrumbs={[
        { name: t("help.footerLink"), href: `/help` },
        { name: t(`help.modes.${mode}`), href: `/help/${mode}` },
      ]}
    >
      <Suspense fallback={null}>
        <ModeArticles mode={mode as HelpMode} />
      </Suspense>
    </HelpPageChrome>
  );
}
