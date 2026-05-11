"use client";

import { useState } from "react";

const DISMISS_KEY = "cloudless-training-banner-dismissed";

const QUOTE_EN = "Pardon our pixels — we're remodeling the universe.";
const QUOTE_EL = "Ζητάμε συγγνώμη για τα pixels — ανακαινίζουμε το σύμπαν.";

interface TrainingBannerProps {
  locale?: string;
}

export default function TrainingBanner({
  locale,
}: Readonly<TrainingBannerProps>) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(DISMISS_KEY);
  });

  if (!visible) return null;

  const isEl = locale === "el";

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      role="note"
      aria-label={
        isEl ? "Σημείωση εκπαιδευτικού έργου" : "Training project notice"
      }
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="font-mono text-[11px] leading-relaxed text-amber-400">
          <span className="mr-1.5 font-bold">⚠</span>
          {isEl ? (
            <>
              <span className="font-semibold">
                Εκπαιδευτικό &amp; Portfolio Project
              </span>
              {" — "}
              Αυτή η ιστοσελίδα δημιουργήθηκε αποκλειστικά για εκπαιδευτικούς
              και portfolio σκοπούς. Δεν αποτελεί εμπορική υπηρεσία, δεν παρέχει
              πραγματικές υπηρεσίες και δεν δέχεται πελάτες.
              <span className="mx-2 opacity-30">·</span>
              <span className="italic opacity-50">υπό κατασκευή</span>
            </>
          ) : (
            <>
              <span className="font-semibold">
                Training &amp; Portfolio Project
              </span>
              {" — "}
              This website is built for educational and portfolio purposes only.
              It is not a commercial service, does not provide real services,
              and does not accept clients.
              <span className="mx-2 opacity-30">·</span>
              <span className="italic opacity-50">under construction</span>
            </>
          )}
          <span className="mx-2 opacity-20">|</span>
          <span className="italic opacity-40">
            &ldquo;{isEl ? QUOTE_EL : QUOTE_EN}&rdquo;
          </span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isEl ? "Κλείσιμο" : "Dismiss"}
          className="shrink-0 text-amber-400/50 transition-colors hover:text-amber-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
