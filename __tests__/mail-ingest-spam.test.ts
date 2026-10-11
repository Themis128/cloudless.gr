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

// ---------------------------------------------------------------------------
// Fail-open handler tests: a throwing headers object (malformed inbound mail)
// must never become an uncaught exception — Email Routing drops/bounces those.
// ---------------------------------------------------------------------------

import { afterEach, vi } from "vitest";
import worker from "../workers/mail-ingest/src/index";

type StubMessage = {
  from: string;
  to: string;
  raw: ReadableStream;
  rawSize: number;
  headers: Headers;
  setReject: (reason: string) => void;
  forward: (rcpt: string) => Promise<void>;
};

function stubMessage(over: Partial<StubMessage> = {}): StubMessage {
  return {
    from: "spammer@evil.example",
    to: "info@cloudless.gr",
    raw: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("From: a@b.c\r\n\r\nhi"));
        c.close();
      },
    }),
    rawSize: 24,
    headers: new Headers({ subject: "hi" }),
    setReject: vi.fn(),
    forward: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const ENV = {
  MAIL_INGEST_URL: "https://webmail.cloudless.gr/ingest",
  MAIL_INGEST_SECRET: "test-secret",
  FALLBACK_FORWARD: "fallback@example.com",
  SPAM_TAG_AT: "4",
  SPAM_REJECT_AT: "9",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("email handler resilience", () => {
  it("delivers untagged when header access throws during scoring", async () => {
    const throwingHeaders = {
      get: () => {
        throw new TypeError("Could not parse header");
      },
    } as unknown as Headers;
    const msg = stubMessage({ headers: throwingHeaders });
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      worker.email(msg as never, ENV as never, {} as never)
    ).resolves.toBeUndefined();
    expect(msg.setReject).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://webmail.cloudless.gr/ingest",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to delivery when setReject itself throws", async () => {
    const msg = stubMessage({
      headers: new Headers({
        subject: "seed phrase wallet verify",
        "received-spf": "fail (...)",
        "authentication-results": "dkim=fail dmarc=fail",
      }),
      setReject: vi.fn(() => {
        throw new Error("cannot reject");
      }),
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      worker.email(msg as never, ENV as never, {} as never)
    ).resolves.toBeUndefined();
    // score 5+2+2+3 = 12 >= rejectAt → setReject attempted, threw → fell
    // through to ingest instead of dying uncaught.
    expect(msg.setReject).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://webmail.cloudless.gr/ingest",
      expect.objectContaining({ method: "POST" })
    );
  });
});
