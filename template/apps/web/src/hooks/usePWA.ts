"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface UsePWAReturn {
  isInstalled: boolean;
  isStandalone: boolean;
  isOnline: boolean;
  isIOS: boolean;
  canInstall: boolean;
  showInstallPrompt: boolean;
  updateAvailable: boolean;
  install: () => Promise<void>;
  dismissInstallPrompt: () => void;
  cacheGallery: (imageUrls: string[]) => Promise<void>;
  refreshApp: () => void;
}

const INSTALL_PROMPT_DISMISSED_KEY = "pwa-install-prompt-dismissed";

export function usePWA(): UsePWAReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Detect iOS
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);
  }, []);

  // Detect standalone mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);
  }, []);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Service worker registration and update detection
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        swRegistrationRef.current = registration;

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Check for waiting worker on load
        if (registration.waiting) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    registerSW();
  }, []);

  // Install prompt handling
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);

      // Check if user previously dismissed
      const dismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
      if (!dismissed) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setInstallPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setShowInstallPrompt(false);
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  const dismissInstallPrompt = useCallback(() => {
    setShowInstallPrompt(false);
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
  }, []);

  const cacheGallery = useCallback(async (imageUrls: string[]) => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: "CACHE_GALLERY",
      imageUrls,
    });
  }, []);

  const refreshApp = useCallback(() => {
    if (!swRegistrationRef.current?.waiting) return;

    swRegistrationRef.current.waiting.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }, []);

  return {
    isInstalled,
    isStandalone,
    isOnline,
    isIOS,
    canInstall: !!installPromptEvent || isIOS,
    showInstallPrompt,
    updateAvailable,
    install,
    dismissInstallPrompt,
    cacheGallery,
    refreshApp,
  };
}
