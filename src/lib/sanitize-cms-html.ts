/**
 * Lightweight CMS HTML sanitizer.
 *
 * Removes the most common attack and deceptive-content vectors from
 * AppFlowy/markdown-generated HTML before it is rendered with
 * dangerouslySetInnerHTML. This is a defensive measure; the real fix is to
 * keep the CMS account secure and the AppFlowy content clean.
 */

const DANGEROUS_TAGS_RE =
  /<(script|style|iframe|object|embed|form|input|button|select|textarea|meta|link|base)\b[^<]*(?:(?:(?!<\/\1>)<[^<]*)*)<\/\1>|<(script|style|iframe|object|embed|form|input|button|select|textarea|meta|link|base)\b[^>]*>/gi;

const EVENT_ATTRS_RE = /\s+(on\w+|xmlns)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

const JS_DATA_URLS_RE = /\s+(href|src|action)\s*=\s*("|')(?:javascript:|data:)[^"']*\2/gi;

export function sanitizeCmsHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS_RE, "")
    .replace(EVENT_ATTRS_RE, "")
    .replace(JS_DATA_URLS_RE, (match) => match.replace(/(?:javascript:|data:)[^'"]*/i, ""));
}
