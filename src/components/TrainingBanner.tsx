"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "cloudless-training-banner-dismissed";

const QUOTE_EN = "Pardon our pixels — we're remodeling the universe.";
const QUOTE_EL = "Ζητάμε συγγνώμη για τα pixels — ανακαινίζουμε το σύμπαν.";

// Campaign-launch gate. Operational mode (NEXT_PUBLIC_PORTFOLIO_MODE !== "true")
// suppresses the banner entirely so paid traffic doesn't land on "not accepting
// clients" copy. Set NEXT_PUBLIC_PORTFOLIO_MODE=true in staging/showcase builds
// to bring it back. Default = operational (banner hidden).
const PORTFOLIO_MODE = process.env.NEXT_PUBLIC_PORTFOLIO_MODE === "true";

interface TrainingBannerProps {
  locale?: string;
}

export default function TrainingBanner({ locale }: Readonly<TrainingBannerProps>) {
  // Operational mode: never render, regardless of dismiss state.
  if (!PORTFOLIO_MODE) return null;

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
      // Solid (not opacity-based) bg so contrast is deterministic
      // regardless of theme/body background. The previous amber-500/10
      // and amber-900/40 both relied on alpha compositing against the
      // body color, which varies between light and dark mode and caused
      // the contrast measurement to fail one or the other.
      className="border-b border-amber-700 bg-amber-950 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {/*
          text-amber-100 on solid amber-950 measures > 12:1 (AAA).
          Avoid opacity-based colors here — they multiply down with the
          foreground until contrast fails on a light- or theme-variant
          background.
        */}
        <p className="font-mono text-[11px] leading-relaxed text-amber-100">
          <span className="mr-1.5 font-bold">⚠</span>
          {isEl ? (
            <>
              <span className="font-semibold">Εκπαιδευτικό &amp; Portfolio Project</span>
              {" — "}
              Αυτή η ιστοσελίδα δημιουργήθηκε αποκλειστικά για εκπαιδευτικούς και portfolio σκοπούς.
              Δεν αποτελεί εμπορική υπηρεσία, δεν παρέχει πραγματικές υπηρεσίες και δεν δέχεται
              πελάτες.
              <span className="mx-2 text-amber-200">·</span>
              <span className="text-amber-200 italic">υπό κατασκευή</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Training &amp; Portfolio Project</span>
              {" — "}
              This website is built for educational and portfolio purposes only. It is not a
              commercial service, does not provide real services, and does not accept clients.
              <span className="mx-2 text-amber-200">·</span>
              <span className="text-amber-200 italic">under construction</span>
            </>
          )}
          <span className="mx-2 text-amber-200">|</span>
          <span className="text-amber-200 italic">&ldquo;{isEl ? QUOTE_EL : QUOTE_EN}&rdquo;</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isEl ? "Κλείσιμο" : "Dismiss"}
          // Solid amber-300 hits 4.5:1; the old `text-amber-400/50` was 2.1:1.
          className="shrink-0 text-amber-200 transition-colors hover:text-amber-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
