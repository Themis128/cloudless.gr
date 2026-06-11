"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// A single shared IntersectionObserver for every ScrollReveal on the page.
// Pages like /services mount 29 of these; one observer per instance spikes
// Total Blocking Time. One observer watching all elements is far cheaper on
// the main thread and behaves identically (each element reveals once, then is
// unobserved). Per-element reveal delay is carried on a data attribute.
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (sharedObserver) return sharedObserver;

  sharedObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay) || 0;
        if (delay > 0) {
          setTimeout(() => el.classList.add("reveal-visible"), delay);
        } else {
          el.classList.add("reveal-visible");
        }
        observer.unobserve(el);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  return sharedObserver;
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: Readonly<ScrollRevealProps>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = getObserver();
    // No IntersectionObserver support (old browsers / SSR edge) — reveal
    // immediately so content is never stuck invisible.
    if (!observer) {
      el.classList.add("reveal-visible");
      return;
    }

    observer.observe(el);
    return () => observer.unobserve(el);
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`} data-reveal-delay={delay || undefined}>
      {children}
    </div>
  );
}
