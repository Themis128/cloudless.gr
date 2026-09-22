/**
 * Lightweight CMS HTML sanitizer.
 *
 * Removes the most common attack and deceptive-content vectors from
 * AppFlowy/markdown-generated HTML before it is rendered with
 * dangerouslySetInnerHTML. This is a defensive measure; the real fix is to
 * keep the CMS account secure and the AppFlowy content clean.
 *
 * Each replacement is single-pass complete: dangerous tag delimiters are
 * escaped to "&lt;" (which can never re-form "<"), script/style payloads are
 * dropped once their delimiters are inert, event attributes are collapsed to
 * a fixed inert name, and dangerous URL schemes are blanked to "#".
 */

const DANGEROUS_TAGS =
  "(?:script|style|iframe|object|embed|form|input|button|select|textarea|meta|link|base)";

// The "<" or "</" that opens a dangerous tag. Replaced with "&lt;" — the
// escaped output can never re-form a real tag, so a single pass is complete.
const DANGEROUS_TAG_DELIM_RE = new RegExp(`<\\/?(?=${DANGEROUS_TAGS}\\b)`, "gi");

// After escaping, script/style payloads are inert text — drop them so the raw
// JS/CSS is not rendered to the reader.
const ESCAPED_SCRIPT_STYLE_RE =
  /&lt;\/?(?:script|style)\b[^>]*>(?:[\s\S]*?&lt;\/(?:script|style)\s*>)?/gi;

// Event-handler / xmlns attributes collapse to a fixed inert name. The
// replacement has no "=", so it can never match the pattern again.
const EVENT_ATTRS_RE = /\s+(?:on\w+|xmlns)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// href/src/action values starting with javascript:/data: are blanked to "#";
// the replacement contains no scheme, so it cannot re-form the pattern.
const JS_DATA_URLS_RE = /\s+(href|src|action)\s*=\s*("|')\s*(?:javascript:|data:)[^"']*\2/gi;

export function sanitizeCmsHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAG_DELIM_RE, (m) => (m === "</" ? "&lt;/" : "&lt;"))
    .replace(ESCAPED_SCRIPT_STYLE_RE, "")
    .replace(EVENT_ATTRS_RE, " data-removed")
    .replace(JS_DATA_URLS_RE, (_m, attr: string, quote: string) => ` ${attr}=${quote}#${quote}`);
}
