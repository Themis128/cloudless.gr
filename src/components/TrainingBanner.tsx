"use client";

/**
 * Training banner component - placeholder for training/CTA banner.
 * This component was referenced in layout but missing.
 */
import { useEffect, useState } from "react";

export default function TrainingBanner(_props: { locale: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if banner should be shown (e.g., based on consent, user prefs, etc.)
    const dismissed = typeof window !== "undefined" && localStorage.getItem("training-banner-dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan mb-4 rounded-lg border px-4 py-2 text-center font-mono text-sm">
      <span>🚀 Training available — book a session with the team</span>
      <button
        onClick={() => {
          setVisible(false);
          localStorage.setItem("training-banner-dismissed", "true");
        }}
        className="ml-2 text-slate-400 hover:text-white"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}