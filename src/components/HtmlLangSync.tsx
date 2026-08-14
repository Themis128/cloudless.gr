"use client";

import { useEffect } from "react";

/** Keep <html lang> in sync on client-side locale switches (root layout does not re-render). */
export default function HtmlLangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
