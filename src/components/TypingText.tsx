"use client";

import { useEffect, useState } from "react";

interface TypingTextProps {
  texts: string[];
  /** Text rendered immediately (SSR + before animation). Defaults to texts[0]. */
  initialText?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
}

export default function TypingText({
  texts,
  initialText,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = "",
}: TypingTextProps) {
  const firstText = initialText ?? texts[0] ?? "";
  const [displayed, setDisplayed] = useState(firstText);
  const [textIndex, setTextIndex] = useState(0);
  // Start charIndex at the end of the initial text so the pause fires first
  const [charIndex, setCharIndex] = useState(firstText.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
