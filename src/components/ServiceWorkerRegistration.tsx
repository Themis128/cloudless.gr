"use client";

import { useEffect, useRef, useState } from "react";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let hasRegisteredServiceWorker = false;

export default function ServiceWorkerRegistration() {
  const [locale] = useCurrentLocale();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const refreshingRef = useRef(false);

  const isE2E = process.env.NEXT_PUBLIC_E2E === "1";

  useEffect(() => {
    if (isE2E) return;
    if (!("serviceWorker" in navigator)) return;

    // Install prompt
    const onInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    // Register SW and wire up update detection
    if (!hasRegisteredServiceWorker) {
      hasRegisteredServiceWorker = true;
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Already-waiting SW (e.g. page reloaded after deploy)
          if (registration.waiting) {
            setShowUpdateBanner(true);
          }
          // New SW installed and now waiting
          if (typeof registration.addEventListener === "function") {
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (!newWorker) return;
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  setShowUpdateBanner(true);
                }
              });
            });
          }
        })
        .catch(() => {
          // Intentionally silent: SW is a progressive enhancement
        });
    }

    // Reload when the new SW takes control (after SKIP_WAITING)
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    if (typeof navigator.serviceWorker.addEventListener === "function") {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      if (typeof navigator.serviceWorker.removeEventListener === "function") {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
    };
  }, [isE2E]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if