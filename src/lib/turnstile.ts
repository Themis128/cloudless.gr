/**
 * Cloudflare Turnstile server verification.
 * Soft-skip when TURNSTILE_SECRET_KEY is unset (local/dev); enforce when set.
 */

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function getTurnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteip?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // Not configured — allow through (dev / gradual rollout).
    return { ok: true };
  }

  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, error: "Missing Turnstile token." };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteip) body.set("remoteip", remoteip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      return {
        ok: false,
        error: `Turnstile rejected (${(data["error-codes"] ?? ["unknown"]).join(",")}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[turnstile] verify failed:", err);
    return { ok: false, error: "Turnstile verification failed." };
  }
}
