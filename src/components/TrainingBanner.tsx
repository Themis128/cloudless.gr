"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "cloudless-training-banner-dismissed";

const QUOTE_EN = "Pardon our pixels — we're remodeling the universe.";
const QUOTE_EL = "Ζητάμε συγγνώμη για τα pixels — ανακαινίζουμε το σύμπαν.";

interface TrainingBannerProps {
  locale?: string;
}

export default function TrainingBanner({ locale }: Readonly<TrainingBannerProps>) {
  // Mount-deferred: SSR renders nothing, client reveals banner after hydration.
  // useSyncExternalStore with getServerSnapshot=false caused React #418 because
  // the client snapshot ran synchronously during hydration, mismatch-ing null→element.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionStorage.getItem(DISMISS_KEY)) setMounted(true);
  }, []);

  if (!mounted || dismissed) return null;

  const isEl = locale === "el";

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="note"
      aria-label={isEl ? "Σημείωση εκπαιδευτικού έργου" : "Training project notice"}
      // bg + border are deepened so foreground text reliably hits WCAG AA
      // contrast (>= 4.5:1) against the banner background. The previous
      // amber-500/10 was ~2.3:1 with amber-400 text and caused 5
      // serious/critical color-contrast violations on every page.
      className="border-b border-amber-400/60 bg-amber-900/40 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/*
          text-amber-200 on the amber-900/40 background measures > 7:1 (AAA);
          the bullet/quote helpers no longer use raw `opacity-*` because that
          multiplies down with the foreground color until contrast fails on
          a dark mode background. We replace opacity helpers with named tints
          (text-amber-300) which keep their stated contrast ratio.
        */}
        <p className="font-mono text-[11px] leading-relaxed text-amber-200">
          <span className="mr-1.5 font-bold">⚠</span>
          {isEl ? (
            <>
              <span className="font-semibold">Εκπαιδευτικό &amp; Portfolio Project</span>
              {" — "}
              Αυτή η ιστοσελίδα δημιουργήθηκε αποκλειστικά για εκπαιδευτικούς και portfolio σκοπούς.
              Δεν αποτελεί εμπορική υπηρεσία, δεν παρέχει πραγματικές υπηρεσίες και δεν δέχεται
              πελάτες.
              <span className="mx-2 text-amber-300">·</span>
              <span className="italic text-amber-300">υπό κατασκευή</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Training &amp; Portfolio Project</span>
              {" — "}
              This website is built for educational and portfolio purposes only. It is not a
              commercial service, does not provide real services, and does not accept clients.
              <span className="mx-2 text-amber-300">·</span>
              <span className="italic text-amber-300">under construction</span>
            </>
          )}
          <span className="mx-2 text-amber-300">|</span>
          <span className="italic text-amber-300">&ldquo;{isEl ? QUOTE_EL : QUOTE_EN}&rdquo;</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isEl ? "Κλείσιμο" : "Dismiss"}
          // Solid amber-300 hits 4.5:1; the old `text-amber-400/50` was 2.1:1.
          className="shrink-0 text-amber-300 transition-colors hover:text-amber-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
