"use client";

import { usePWA } from "@/hooks/usePWA";
import { InstallPrompt } from "./InstallPrompt";
import { OfflineIndicator } from "./OfflineIndicator";
import { UpdateNotification } from "./UpdateNotification";

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const {
    isOnline,
    isIOS,
    showInstallPrompt,
    updateAvailable,
    install,
    dismissInstallPrompt,
    refreshApp,
  } = usePWA();

  return (
    <>
      <OfflineIndicator isVisible={!isOnline} />
      {children}
      {showInstallPrompt && (
        <InstallPrompt isIOS={isIOS} onInstall={install} onDismiss={dismissInstallPrompt} />
      )}
      <UpdateNotification isVisible={updateAvailable} onRefresh={refreshApp} />
    </>
  );
}
