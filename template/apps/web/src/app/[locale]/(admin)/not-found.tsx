import { getTranslations } from "next-intl/server";

/**
 * requireAdministrator() calls notFound() for an authenticated non-administrator.
 * This boundary sits under the (admin) layout, so the 404 renders inside the app
 * frame (sidebar and all) instead of replacing the whole page.
 */
export default async function AdminNotFound() {
  const t = await getTranslations();

  return (
    <div className="bg-sidebar flex h-full w-full min-w-0 flex-1 flex-col">
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-2 rounded-t-xl p-6 text-center md:me-2 md:mt-12 md:rounded-xl">
        <h1 className="text-2xl font-semibold">{t("errors.404.title")}</h1>
        <p className="text-muted-foreground">{t("errors.404.message")}</p>
      </div>
    </div>
  );
}
