import { HELP_MODES, type HelpMode } from "@carlonicora/nextjs-jsonapi/help/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpPageChrome } from "@/features/essentials/how-to/components/HelpPageChrome";
import { fetchPublicHowTos } from "../_data/publicHowTo";

export const revalidate = 3600;

export default async function HelpModePage({ params }: { params: Promise<{ locale: string; mode: string }> }) {
  const { locale, mode } = await params;
  if (!(HELP_MODES as readonly string[]).includes(mode)) notFound();
  const t = await getTranslations();

  const articles = (await fetchPublicHowTos({ howToType: mode as HelpMode })).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  return (
    <HelpPageChrome
      titleType={t(`help.modes.${mode}`)}
      breadcrumbs={[
        { name: t("help.footerLink"), href: `/${locale}/help` },
        { name: t(`help.modes.${mode}`), href: `/${locale}/help/${mode}` },
      ]}
    >
      {articles.length === 0 ? (
        <p className="text-muted-foreground">{t("help.modeIndex.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/${locale}/help/${a.howToType}/${a.slug}`}
                className="hover:bg-muted block rounded border p-3"
              >
                <div className="font-medium">{a.name}</div>
                <div className="text-muted-foreground text-sm">{a.summary}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HelpPageChrome>
  );
}
