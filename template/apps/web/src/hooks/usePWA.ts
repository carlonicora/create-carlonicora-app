"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);
  }, []);

  // Detect standalone mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);
  }, []);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't use navigator.onLine for initial state — it can return false
    // even when the network is working (e.g. dev server with HMR connected).
    // The useState default (true) is the safe initial value. Only the
    // online/offline events should change the state.

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
        // RELATIVE, not an absolute URL: service-worker registration is
        // same-origin only, so an absolute URL registers on exactly one origin
        // and silently fails on every other (a preview domain, an IP, localhost).
        //
        // /sw.js is a REWRITE (next.config.js): in production it serves the
        // Serwist worker built from src/app/sw.ts; in development it serves the
        // push-only public/sw-dev.js, which has no fetch handler and therefore
        // cannot serve stale Turbopack chunks.
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

  const refreshApp = useCallback(() => {
    if (!swRegistrationRef.current?.waiting) return;

    // Reload only once the new worker has taken control. An immediate reload can
    // beat activation and serve the OLD assets again, so the update toast comes
    // straight back and the app looks stuck on the previous version.
    //
    // The SKIP_WAITING message is handled by Serwist itself: src/app/sw.ts
    // constructs it with `skipWaiting: false`, which registers exactly this
    // listener. (The former public/sw.js handled no messages at all, so this
    // whole path was dead.)
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    swRegistrationRef.current.waiting.postMessage({ type: "SKIP_WAITING" });
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
    refreshApp,
  };
}
