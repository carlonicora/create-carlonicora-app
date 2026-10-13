import "@carlonicora/nextjs-jsonapi/contexts/styles.css";
import "react-horizontal-scrolling-menu/dist/styles.css";

import { AppShell } from "@/features/common/components/session/AppShell";
import { AppFrameSkeleton } from "@/features/common/components/skeletons/AppFrameSkeleton";
import { Suspense } from "react";

export default function MainLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { children } = props;

  return (
    <Suspense fallback={<AppFrameSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
