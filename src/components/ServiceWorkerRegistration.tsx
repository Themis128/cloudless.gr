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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      if (typeof navigator.serviceWorker.removeEventListener === "function") {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, [isE2E]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  }

  async function handleUpdate() {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage("SKIP_WAITING");
    }
  }

  if (isE2E) return null;

  // Update banner takes priority over the install banner
  if (showUpdateBanner) {
    return (
      <div className="animate-fade-in-up fixed right-4 bottom-4 left-4 z-50 md:right-6 md:left-auto md:max-w-sm">
        <div className="border-neon-cyan/30 bg-void/95 rounded-lg border p-4 shadow-[0_0_20px_rgba(0,255,245,0.1)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <span className="text-neon-cyan shrink-0 font-mono text-lg">↻</span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-white">
                {translate(locale, "pwa.updateTitle", "Update available")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {translate(
                  locale,
                  "pwa.updateDesc",
                  "A new version of Cloudless is ready.",
                )}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10 rounded-lg border px-4 py-1.5 font-mono text-xs font-semibold transition-all"
                >
                  {translate(locale, "pwa.reload", "Reload")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpdateBanner(false)}
                  className="font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
                >
                  {translate(locale, "pwa.notNow", "Not now")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div className="animate-fade-in-up fixed right-4 bottom-4 left-4 z-50 md:right-6 md:left-auto md:max-w-sm">
      <div className="border-neon-cyan/30 bg-void/95 rounded-lg border p-4 shadow-[0_0_20px_rgba(0,255,245,0.1)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="text-neon-cyan shrink-0 font-mono text-lg">⚡</span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-semibold text-white">
              {translate(locale, "pwa.installTitle", "Install Cloudless")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {translate(
                locale,
                "pwa.installDesc",
                "Add to your home screen for offline access and a faster experience.",
              )}
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleInstall}
                className="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10 rounded-lg border px-4 py-1.5 font-mono text-xs font-semibold transition-all"
              >
                {translate(locale, "pwa.install", "Install")}
              </button>
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                {translate(locale, "pwa.notNow", "Not now")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
