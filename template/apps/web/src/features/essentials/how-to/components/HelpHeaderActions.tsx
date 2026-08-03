"use client";

import { Button, Link } from "@carlonicora/nextjs-jsonapi/components";
import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { HelpAskAi } from "@carlonicora/nextjs-jsonapi/help";
import { useTranslations } from "next-intl";

export function HelpHeaderActions() {
  const t = useTranslations();
  const { currentUser } = useCurrentUserContext();

  return (
    <div className="flex items-center gap-2">
      <HelpAskAi />
      <Button
        render={<Link href={currentUser ? "/" : "/login"} />}
        nativeButton={false}
        variant="outline"
        size="sm"
      >
        {currentUser ? t("help.header.openApp") : t("help.header.login")}
      </Button>
    </div>
  );
}
