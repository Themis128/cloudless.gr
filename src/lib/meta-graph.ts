/**
 * Shared Meta Graph / Marketing API constants.
 *
 * Keep CAPI, ads insights, and integrations status on ONE version string.
 * Official current (2026-09): v26.0 — see
 * https://developers.facebook.com/docs/graph-api/changelog/versions/
 */

export const META_GRAPH_API_VERSION = "v26.0";

export const META_GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/** Ensure Marketing API account ids use the required `act_` prefix. */
export function normalizeMetaAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export function metaGraphUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${META_GRAPH_API_BASE}${normalized}`;
}

/** AdAccount.account_status (Marketing API reference). */
export const META_ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
  201: "ANY_ACTIVE",
  202: "ANY_CLOSED",
};

/** AdAccount.disable_reason (Marketing API reference). */
export const META_DISABLE_REASON_LABEL: Record<number, string> = {
  0: "NONE",
  1: "ADS_INTEGRITY_POLICY",
  2: "ADS_IP_REVIEW",
  3: "RISK_PAYMENT",
  4: "GRAY_ACCOUNT_SHUT_DOWN",
  5: "ADS_AFC_REVIEW",
  6: "BUSINESS_INTEGRITY_RAR",
  7: "PERMANENT_CLOSE",
  8: "UNUSED_RESELLER_ACCOUNT",
  9: "UNUSED_ACCOUNT",
  10: "UMBRELLA_AD_ACCOUNT",
  11: "BUSINESS_MANAGER_INTEGRITY_POLICY",
  12: "MISREPRESENTED_AD_ACCOUNT",
  13: "AOAB_DESHARE_LEGAL_ENTITY",
  14: "CTX_THREAD_REVIEW",
  15: "COMPROMISED_AD_ACCOUNT",
};

export function formatMetaDisableReason(code: number | undefined): string {
  if (code === undefined || code === null) return "unknown";
  return META_DISABLE_REASON_LABEL[code] ?? `code_${code}`;
}
