"use client";

import { useState, useEffect, useRef } from "react";
import { localeLabels, locales, type Locale } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

const localeFlags: Record<Locale, string> = {
  en: "EN",
  el: "EL",
  fr: "FR",
};

export default function LocaleSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useCurrentLocale();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleLocaleChange = (locale: Locale) => {
    setIsOpen(false);
    // setCurrentLocale navigates to the same path with the new locale prefix
    setCurrentLocale(locale);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Language: ${localeLabels[currentLocale]}. Click to change.`}
        aria-haspopup="listbox"
        aria-controls="locale-listbox"
        className="hover:text-neon-cyan active:text-neon-cyan flex min-h-11 items-center gap-2 px-3 py-2 text-slate-400 transition-colors"
      >
        {localeFlags[currentLocale]}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          id="locale-listbox"
          role="listbox"
          aria-label="Select language"
          className="bg-void border-neon-cyan/20 absolute top-full right-0 z-50 mt-2 w-36 overflow-hidden rounded-lg border shadow-lg"
        >
          {locales.map((locale) =>
            locale === currentLocale ? (
              <button
                type="button"
                key={locale}
                role="option"
                aria-selected="true"
                onClick={() => handleLocaleChange(locale)}
                aria-label={`Set language to ${localeLabels[locale]}`}
                className="hover:bg-neon-cyan/10 active:bg-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan min-h-11 w-full px-4 py-2.5 text-left text-sm font-medium transition-colors"
              >
                <span className="mr-2 font-mono text-xs opacity-60">
                  {localeFlags[locale]}
                </span>
                {localeLabels[locale]}
              </button>
            ) : (
              <button
                type="button"
                key={locale}
                role="option"
                aria-selected="false"
                onClick={() => handleLocaleChange(locale)}
                aria-label={`Set language to ${localeLabels[locale]}`}
                className="hover:bg-neon-cyan/10 active:bg-neon-cyan/20 min-h-11 w-full px-4 py-2.5 text-left text-sm text-slate-300 transition-colors"
              >
                <span className="mr-2 font-mono text-xs opacity-60">
                  {localeFlags[locale]}
   