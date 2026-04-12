"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator && !hasRegisteredServiceWorker) {
      hasRegisteredServiceWorker = true;
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.warn("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
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
                onClick={handleInstall}
                className="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10 rounded-lg border px-4 py-1.5 font-mono text-xs font-semibold transition-all"
              >
                {translate(locale, "pwa.install", "Install")}
              </button>
              <button
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
