/**
 * Email suppression list — D1-only (Cloudflare migration).
 *
 * Re-exports the D1 implementation. AWS SES suppression has been removed.
 */

export {
  addToSuppressionList,
  removeFromSuppressionList,
  isSuppressed,
  getSuppressedEmails,
  setD1Binding,
} from "@/lib/ses-suppression-d1";
