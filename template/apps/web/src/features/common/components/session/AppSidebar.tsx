"use client";

import CommonSidebar from "@/features/common/components/navigations/CommonSidebar";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@carlonicora/nextjs-jsonapi/contexts";
import { useEffect } from "react";

export function AppSidebar() {
  const { isLogged } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  return <CommonSidebar />;
}
