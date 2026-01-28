"use client";

import { useTranslations } from "next-intl";
import packageInfo from "../../../../../../../package.json";

export const getAppVersion = () => {
  return packageInfo.version;
};

export default function VersionDisplay() {
  const t = useTranslations();

  return (
    <div className="text-muted-foreground flex w-full flex-col text-xs">
      <div className="flex w-full flex-row justify-between">
        <div className="flex w-full">{t("common.version_display")}</div>
        <div className="flex">{getAppVersion()}</div>
      </div>
    </div>
  );
}
