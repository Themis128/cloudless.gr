import { describe, expect, it } from "vitest";
import {
  scoreHeaders,
  senderIpFromHeaders,
} from "../workers/mail-ingest/src/index";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("mail-ingest spam scoring", () => {
  it("clean transactional mail scores 0", () => {
    const v = scoreHeaders(
      headers({
        "received-spf":
          "pass (mx.cloudflare.net: domain of noreply@cloudless.gr designates 54.240.3.14 as permitted sender)",
        "authentication-results": "mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass",
        from: "noreply@cloudless.gr",
        "message-id": "<abc@amazonses.com>",
        subject: "Your post has been published",
      }),
      "noreply@cloudless.gr"
    );
    expect(v.score).toBe(0);
    expect(v.reasons).toEqual([]);
  });

  it("spf fail + dmarc fail scores 8 (tag threshold)", () => {
    const v = scoreHeaders(
      headers({
        "received-spf": "fail (mx.cloudflare.net: ...)",
        "authentication-results": "mx.cloudflare.net; spf=fail; dmarc=fail",
        from: "bad@evil.example",
        "message-id": "<x@evil.example>",
        subject: "Hello",
      }),
      "bad@evil.example"
    );
    expect(v.score).toBe(8);
    expect(v.reasons).toContain("spf_fail");
    expect(v.reasons).toContain("dmarc_fail");
  });

  it("spf softfail + no message-id + reply-to mismatch adds up", () => {
    const v = scoreHeaders(
      headers({
        "received-spf": "softfail (mx.cloudflare.net: ...)",
        from: "a@real.com",
        "reply-to": "b@other.com",
        subject: "normal subject",
      }),
      "a@real.com"
    );
    expect(v.score).toBe(5);
    expect(v.reasons).toEqual(
      expect.arrayContaining(["spf_softfail", "replyto_domain_mismatch", "no_message_id"])
    );
  });

  it("spam subject terms score 2", () => {
    const v = scoreHeaders(
      headers({
        "received-spf": "pass (mx.cloudflare.net: ...)",
        from: "x@ok.com",
        "message-id": "<1@ok.com>",
        subject: "URGENT: verify your wallet to unlock your crypto giveaway",
      }),
      "x@ok.com"
    );
    expect(v.score).toBe(2);
    expect(v.reasons).toContain("subject_spam_terms");
  });

  it("missing/malformed From scores 2", () => {
    const v = scoreHeaders(headers({ "received-spf": "pass" }), "");
    expect(v.score).toBeGreaterThanOrEqual(2);
    expect(v.reasons).toContain("missing_from");
  });
});

describe("senderIpFromHeaders", () => {
  it("extracts the sending IP from the SPF comment", () => {
    expect(
      senderIpFromHeaders(
        headers({
          "received-spf":
            "pass (mx.cloudflare.net: domain of x@y.z designates 54.240.3.14 as permitted sender)",
        })
      )
    ).toBe("54.240.3.14");
  });

  it("skips private IPs in the Received chain", () => {
    const h = headers({
      received:
        "from [172.19.0.3] (unknown [192.168.1.23]); from mail.example.com ([203.0.113.9])",
    });
    expect(senderIpFromHeaders(h)).toBe("203.0.113.9");
  });

  it("returns null when no public IP", () => {
    expect(
      senderIpFromHeaders(headers({ received: "from [192.168.1.23] (unknown)" }))
    ).toBeNull();
  });
});
