import { BlockNoteViewerContainer } from "@carlonicora/nextjs-jsonapi/components";
import { HelpArticleBody } from "@carlonicora/nextjs-jsonapi/help";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { HelpPageChrome } from "@/features/essentials/how-to/components/HelpPageChrome";
import { HelpQuickLinks } from "@/features/essentials/how-to/components/HelpQuickLinks";
import { fetchPublicHowTo, fetchPublicHowTos, fetchRelatedHowTos } from "../../_data/publicHowTo";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string; slug: string }>;
}): Promise<Metadata> {
  const { mode, slug } = await params;
  const article = await fetchPublicHowTo({ howToType: mode, slug });
  if (!article) return {};
  return {
    title: article.name,
    description: article.summary,
    openGraph: { title: article.name, description: article.summary },
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; mode: string; slug: string }>;
}) {
  const { locale, mode, slug } = await params;
  const t = await getTranslations();

  const article = await fetchPublicHowTo({ howToType: mode, slug });
  if (!article) notFound();

  const siblings = (await fetchPublicHowTos({ howToType: mode })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const idx = siblings.findIndex((s) => s.slug === slug);
  const toSibling = (s: (typeof siblings)[number] | undefined) =>
    s ? { howToType: s.howToType ?? mode, slug: s.slug ?? "", title: s.name } : null;
  const prev = toSibling(idx > 0 ? siblings[idx - 1] : undefined);
  const next = toSibling(idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined);

  const related = await fetchRelatedHowTos({ howToType: mode, slug });
  const details = (
    <HelpQuickLinks
      heading={t("help.article.related")}
      items={related.map((r) => ({
        id: r.id,
        name: r.name,
        summary: r.summary,
        howToType: r.howToType ?? mode,
        slug: r.slug ?? "",
      }))}
    />
  );

  return (
    <HelpPageChrome
      titleType={t(`help.modes.${mode}`)}
      titleElement={article.name}
      breadcrumbs={[
        { name: t("help.footerLink"), href: `/${locale}/help` },
        { name: t(`help.modes.${mode}`), href: `/${locale}/help/${mode}` },
        { name: article.name, href: `/${locale}/help/${mode}/${slug}` },
      ]}
      details={details}
    >
      <div className="mx-auto max-w-3xl">
        <HelpArticleBody
          howToType={article.howToType ?? mode}
          title={article.name}
          summary={article.summary}
          updatedAt={article.updatedAt ? article.updatedAt.toISOString() : undefined}
          prev={prev}
          next={next}
        >
          <BlockNoteViewerContainer content={article.description} />
        </HelpArticleBody>
      </div>
    </HelpPageChrome>
  );
}
