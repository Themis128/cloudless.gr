/**
 * Dedicated config loader for the Newsletter Slack app.
 *
 * The Newsletter app is a SEPARATE Slack app from the main Cloudless one
 * (see slack-newsletter-app.manifest.json). It has its own bot token and
 * signing secret so a leak/rotation/scope change on one cannot disrupt the
 * other.
 *
 * Reads NEWSLETTER_SLACK_SIGNING_SECRET / NEWSLETTER_SLACK_BOT_TOKEN from
 * env first, falls back to Cloudflare D1 app_config.
 * Cached after first read; tests can call resetNewsletterSlackConfigCache().
 */

export interface NewsletterSlackConfig {
  NEWSLETTER_SLACK_BOT_TOKEN: string;
  NEWSLETTER_SLACK_SIGNING_SECRET: string;
  /** Channel ID the bot posts management/audit pings to. */
  NEWSLETTER_SLACK_CHANNEL_ID: string;
}

let cached: NewsletterSlackConfig | null = null;

/** True while `next build` collects page data / generates static pages. */
function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export async function getNewsletterSlackConfigAsync(): Promise<NewsletterSlackConfig> {
  if (cached) return cached;

  let token = process.env.NEWSLETTER_SLACK_BOT_TOKEN ?? "";
  let signingSecret = process.env.NEWSLETTER_SLACK_SIGNING_SECRET ?? "";
  let channel = process.env.NEWSLETTER_SLACK_CHANNEL_ID ?? "";

  if (!token || !signingSecret || !channel) {
    try {
      const { getConfig } = await import("@/lib/ssm-config");
      const d1cfg = await getConfig();
      if (!token) token = d1cfg.NEWSLETTER_SLACK_BOT_TOKEN ?? "";
      if (!signingSecret) signingSecret = d1cfg.NEWSLETTER_SLACK_SIGNING_SECRET ?? "";
      if (!channel) channel = d1cfg.NEWSLETTER_SLACK_CHANNEL_ID ?? "";
    } catch (err) {
      if (!isProductionBuildPhase()) {
        console.warn("[NewsletterSlack] D1 config fallback failed:", err);
      }
    }
  }

  // Live workspace ops channel when no explicit id is configured.
  if (!channel) channel = "C0BBDKY6Q9E";

  // Secrets are not available during `next build` on hosted runners — do not
  // spam "unauthorized" into deploy logs. Runtime requests still reject when
  // the secret is missing (see verifyNewsletterSlackRequest).
  if (!signingSecret && !isProductionBuildPhase()) {
    console.warn(
      "[NewsletterSlack] NEWSLETTER_SLACK_SIGNING_SECRET not set — " +
        "every request will be rejected as unauthorized."
    );
  }

  cached = {
    NEWSLETTER_SLACK_BOT_TOKEN: token,
    NEWSLETTER_SLACK_SIGNING_SECRET: signingSecret,
    NEWSLETTER_SLACK_CHANNEL_ID: channel,
  };
  return cached;
}

export function resetNewsletterSlackConfigCache(): void {
  cached = null;
}
