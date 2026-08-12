"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

interface TypingTextProps {
  texts: string[];
  /** Text rendered immediately (SSR + before animation). Defaults to texts[0]. */
  initialText?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

/** Subscribe to the prefers-reduced-motion media query without triggering the
 *  "setState in effect body" lint rule. useSyncExternalStore is the React-blessed
 *  pattern for reading browser state synchronously. */
function useReducedMotion(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);

  const getSnapshot = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // During SSR, assume no preference
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Returns true when the given ref's element is visible in the viewport
 *  AND the user hasn't requested reduced motion. Used to pause all the
 *  typing animation when the text is off screen or reduced motion is requested.
 */
function useTypingActive(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      // Start animating slightly before scroll lands on the widget so
      // the first frame the user sees is already up-to-date.
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAllowed(!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  return visible && allowed;
}

export default function TypingText({
  texts,
  initialText,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = "",
}: TypingTextProps) {
  const firstText = useMemo(() => initialText ?? texts[0] ?? "", [initialText, texts]);
  const [displayed, setDisplayed] = useState(firstText);
  const [textIndex, setTextIndex] = useState(0);
  // Start charIndex at the end of the initial text so the pause fires first
  const [charIndex, setCharIndex] = useState(firstText.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const active = useTypingActive(ref);

  useEffect(() => {
    if (reducedMotion || !active) return;
    const current = texts[textIndex];

    if (!isDeleting && charIndex < current.length) {
      const timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, typingSpeed);
      return () => clearTimeout(timeout);
    }

    if (!isDeleting && charIndex === current.length) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIndex > 0) {
      const timeout = setTimeout(() => {
        setDisplayed(current.slice(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      }, deletingSpeed);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIndex === 0) {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setTextIndex((textIndex + 1) % texts.length);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [
    charIndex,
    isDeleting,
    textIndex,
    texts,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    reducedMotion,
    active,
  ]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {displayed}
      {!reducedMotion && <span className="typing-cursor" />}
    </span>
  );
}
