"use client";

import { RoundPageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { useTranslations } from "next-intl";

export default function IndexContainer() {
  const t = useTranslations();

  return (
    <RoundPageContainer>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-primary text-3xl font-semibold">{t("common.home")}</h1>
      </div>
    </RoundPageContainer>
  );
}
