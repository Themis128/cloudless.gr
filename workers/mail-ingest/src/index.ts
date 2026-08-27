/**
 * Cloudflare Email Worker (FREE): inbound @cloudless.gr → HTTPS ingest on omv-ha.
 *
 * Email Routing binds this Worker; we POST raw RFC822 to MAIL_INGEST_URL with a
 * shared secret. Optional FALLBACK_FORWARD (verified destination) keeps Gmail
 * as a safety net while soak-testing.
 *
 * Secrets (wrangler secret put):
 *   MAIL_INGEST_SECRET
 * Vars:
 *   MAIL_INGEST_URL=https://webmail.cloudless.gr/ingest
 *   FALLBACK_FORWARD=themis.baltzakis@gmail.com  (optional)
 */
export interface Env {
  MAIL_INGEST_URL: string;
  MAIL_INGEST_SECRET: string;
  /** Verified Email Routing destination — optional Gmail safety net. */
  FALLBACK_FORWARD?: string;
}

export default {
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const subject = message.headers.get("subject") ?? "";
    console.log(
      JSON.stringify({
        event: "inbound",
        from: message.from,
        to: message.to,
        subject,
        bytes: message.rawSize,
      })
    );

    if (!env.MAIL_INGEST_URL || !env.MAIL_INGEST_SECRET) {
      console.error("MAIL_INGEST_URL or MAIL_INGEST_SECRET unset");
      if (env.FALLBACK_FORWARD) {
        await message.forward(env.FALLBACK_FORWARD);
        return;
      }
      message.setReject("Mailbox ingest not configured");
      return;
    }

    try {
      const raw = await new Response(message.raw).arrayBuffer();
      const res = await fetch(env.MAIL_INGEST_URL, {
        method: "POST",
        headers: {
          "content-type": "message/rfc822",
          "x-mail-ingest-secret": env.MAIL_INGEST_SECRET,
          "x-mail-to": message.to,
          "x-mail-from": message.from,
        },
        body: raw,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`ingest ${res.status}: ${detail.slice(0, 200)}`);
        if (env.FALLBACK_FORWARD) {
          await message.forward(env.FALLBACK_FORWARD);
          return;
        }
        message.setReject(`Ingest failed (${res.status})`);
        return;
      }

      // Optional mirror to Gmail during cutover (set FALLBACK_FORWARD + MIRROR=1 via var)
      // Default: deliver only to dovecot once ingest succeeds.
    } catch (err) {
      console.error("ingest threw", err);
      if (env.FALLBACK_FORWARD) {
        await message.forward(env.FALLBACK_FORWARD);
        return;
      }
      message.setReject("Ingest unavailable");
    }
  },
};
