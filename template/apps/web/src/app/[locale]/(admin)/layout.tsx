import "react-horizontal-scrolling-menu/dist/styles.css";

import { AppShell } from "@/features/common/components/session/AppShell";
import { AppFrameSkeleton } from "@/features/common/components/skeletons/AppFrameSkeleton";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../../globals.css";

export default async function AdminLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const { locale } = params;
  const { children } = props;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <Suspense fallback={<AppFrameSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
