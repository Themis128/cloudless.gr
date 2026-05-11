"use client";

/**
 * TrainingBanner — sitewide non-compete / educational-purpose notice.
 * Appears above the Navbar on every page. Dismissible per browser session
 * via sessionStorage so it reappears on a new tab/visit without being
 * obnoxious mid-session.
 */

import { useState, useEffect } from "react";

const DISMISS_KEY = "cloudless-training-banner-dismissed";

const QUOTES_EN = [
  "We're 90% done. The other 90% is in progress.",
  "Our bugs are just undocumented features in training.",
  "Under construction since the dawn of time. Or last Tuesday.",
  "This site is in beta. The beta is also in beta.",
  "Pardon our pixels — we're remodeling the universe.",
  "Code quality: aspirational. Coffee quality: excellent.",
];

const QUOTES_EL = [
  "Είμαστε 90% έτοιμοι. Το άλλο 90% έρχεται σύντομα.",
  "Τα bugs μας είναι απλώς αδιαμόρφωτα features υπό εκπαίδευση.",
  "Υπό κατασκευή από την αυγή των χρόνων. Ή από την περασμένη Τρίτη.",
  "Αυτό το site είναι σε beta. Και το beta είναι επίσης σε beta.",
  "Ζητάμε συγγνώμη για τα pixels — ανακαινίζουμε το σύμπαν.",
  "Ποιότητα κώδικα: φιλόδοξη. Ποιότητα καφέ: εξαιρετική.",
];

interface TrainingBannerProps {
  locale?: string;
}

export default function TrainingBanner({
  locale,
}: Readonly<TrainingBannerProps>) {
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem(DISMISS_KEY)) {
      setVisible(true);
    }
    const pool = locale === "el" ? QUOTES_EL : QUOTES_EN;
    setQuote(pool[Math.floor(Math.random() * pool.length)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {quote && (
            <>
              <span className="mx-2 opacity-20">|</span>
              <span className="italic opacity-40">&ldquo;{quote}&rdquo;</span>
            </>
          )}
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
