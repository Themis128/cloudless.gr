/**
 * Lightweight CMS HTML sanitizer.
 *
 * Removes the most common attack and deceptive-content vectors from
 * AppFlowy/markdown-generated HTML before it is rendered with
 * dangerouslySetInnerHTML. This is a defensive measure; the real fix is to
 * keep the CMS account secure and the AppFlowy content clean.
 *
 * Each replacement is single-pass complete: dangerous constructs are escaped
 * or renamed rather than deleted, so the output can never re-form the matched
 * pattern (no fixpoint re-run needed).
 */

// Matches only the "<" (or "</") that opens a dangerous tag; replacing it with
// "&lt;" permanently inertes the tag — the remainder can never re-form "<".
const DANGEROUS_TAG_DELIM_RE =
  /<\/?(?=(?:script|style|iframe|object|embed|form|input|button|select|textarea|meta|link|base)\b)/gi;

// Event-handler / xmlns attributes are renamed to an inert data-* attribute;
// the new name starts with "d" at the whitespace boundary, so it can never
// match the on*/xmlns pattern again.
const EVENT_ATTRS_RE = /\s+(on\w+|xmlns)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

// href/src/action values starting with javascript:/data: are blanked to "#";
// the replacement contains no scheme, so it cannot re-form the pattern.
const JS_DATA_URLS_RE = /\s+(href|src|action)\s*=\s*("|')\s*(?:javascript:|data:)[^"']*\2/gi;

export function sanitizeCmsHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAG_DELIM_RE, (m) => (m === "</" ? "&lt;/" : "&lt;"))
    .replace(EVENT_ATTRS_RE, (_m, name: string) => ` data-sanitized-${name}`)
    .replace(JS_DATA_URLS_RE, (_m, attr: string, quote: string) => ` ${attr}=${quote}#${quote}`);
}
