/**
 * Newsletter cover generation via SocialAuto (social.cloudless.gr).
 *
 * The weekly cron (newsletter-auto) calls this before assembling the issue:
 * SocialAuto renders the branded banner (1200x675 PNG, deterministic PIL
 * typography) and returns the bytes. cloudless.gr uploads them to R2 and
 * embeds the URL in the email + article.
 *
 * Auth: shared secret NEWSLETTER_SERVICE_TOKEN (must match the
 * NEWSLETTER_SERVICE_TOKEN setting on the SocialAuto side).
 *
 * Every failure path returns null — the newsletter must still send without
 * a cover.
 */

const SOCIALAUTO_BASE = (process.env.SOCIALAUTO_API_URL || "https://social.cloudless.gr").replace(
  /\/+$/,
  ""
);

export interface NewsletterCoverResult {
  buffer: ArrayBuffer;
  slug: string;
}

export async function fetchNewsletterCover(input: {
  title: string;
  slug: string;
  category?: string;
  date?: string;
  issueNumber?: number;
}): Promise<NewsletterCoverResult | null> {
  const token = (process.env.NEWSLETTER_SERVICE_TOKEN || "").trim();
  if (!token) return null;

  try {
    const res = await fetch(`${SOCIALAUTO_BASE}/api/v1/newsletter/cover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": token,
      },
      body: JSON.stringify({
        title: input.title,
        category: input.category,
        issue_date: input.date,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image/png")) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 1000) return null;
    return { buffer, slug: input.slug };
  } catch (err) {
    console.error("[newsletter-cover] SocialAuto fetch failed:", err);
    return null;
  }
}
