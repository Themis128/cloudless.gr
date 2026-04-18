"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

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
    [],
  );

  // During SSR, assume no preference
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function TypingText({
  texts,
  initialText,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = "",
}: TypingTextProps) {
  const firstText = useMemo(
    () => initialText ?? texts[0] ?? "",
    [initialText, texts],
  );
  const [displayed, setDisplayed] = useState(firstText);
  const [textIndex, setTextIndex] = useState(0);
  // Start charIndex at the end of the initial text so the pause fires first
  const [charIndex, setCharIndex] = useState(firstText.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
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
  ]);

  return (
    <span className={className}>
      {displayed}
      {!reducedMotion && <span className="typing-cursor" />}
    </span>
  );
}
