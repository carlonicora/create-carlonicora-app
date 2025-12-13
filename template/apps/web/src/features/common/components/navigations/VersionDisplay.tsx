"use client";

import packageInfo from "../../../../../../../package.json";

export const getAppVersion = () => {
  return packageInfo.version;
};

export default function VersionDisplay() {
  return (
    <div className="text-muted-foreground flex w-full flex-col text-xs">
      <div className="flex w-full flex-row justify-between">
        <div className="flex w-full">Phlow Version</div>
        <div className="flex">{getAppVersion()}</div>
      </div>
    </div>
  );
}
