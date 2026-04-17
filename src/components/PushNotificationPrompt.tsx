"use client";

import { useEffect, useState } from "react";

export default function PushNotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if notifications aren't supported or already granted/denied
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "default"
    )
      return;

    // Check if already dismissed this session
    try {
      if (sessionStorage.getItem("cloudless-push-dismissed") === "1") return;
    } catch {
      // sessionStorage not available
    }

    // Track visits
    let visits = 1;
    try {
      visits = parseInt(sessionStorage.getItem("cloudless-visits") || "0") + 1;
      sessionStorage.setItem("cloudless-visits", String(visits));
    } catch {
      // ignore
    }

    // Show on 2nd visit immediately (deferred), or after 30s on first visit
    if (visits >= 2) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShow(true), 30000);
      return () => clearTimeout(timer);
    }
  }, []);

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Could register push subscription here
    }
    setShow(false);
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem("cloudless-push-dismissed", "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="animate-fade-in-up fixed right-4 bottom-4 z-50 max-w-xs md:right-6">
      <div className="border-neon-cyan/20 bg-void/95 rounded-lg border p-4 shadow-[0_0_15px_rgba(0,255,245,0.08)] backdrop-blur-xl">
        <p className="font-mono text-sm font-semibold text-white">
          🔔 Stay updated
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Get notified about new cloud tips and special offers.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            onClick={handleEnable}
            className="text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/10 rounded-lg border px-4 py-1.5 font-mono text-xs font-semibold transition-all"
          >
            Enable
          </button>
          <button
            onClick={handleDismiss}
            className="font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
