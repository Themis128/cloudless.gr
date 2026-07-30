/**
 * Escapes HTML special characters to prevent XSS in email bodies.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip HTML tags for plain-text email parts.
 * Bounded tag match + residual `<>` removal avoids ReDoS and incomplete
 * multi-character sanitization (CodeQL js/polynomial-redos,
 * js/incomplete-multi-character-sanitization).
 */
export function htmlToPlainText(html: string): string {
  let text = String(html);
  // Bounded quantifier — no unbounded [^>]* on attacker-controlled input.
  text = text.replace(/<[^>]{0,2000}>/g, " ");
  // Collapse any leftover angle brackets from partial/"nested" tag tricks.
  text = text.replace(/[<>]/g, "");
  return text.replace(/[ \t\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Collapse CR/LF/control chars so log lines cannot be injected. */
export function sanitizeForLog(value: unknown): string {
  return String(value).replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 500);
}
