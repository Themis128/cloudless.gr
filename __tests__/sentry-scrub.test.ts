import { describe, expect, it } from "vitest";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";
import type { ErrorEvent, EventHint, Breadcrumb } from "@sentry/core";

const HINT = {} as EventHint;

function event(over: Partial<ErrorEvent>): ErrorEvent {
  return over as ErrorEvent;
}

describe("scrubEvent", () => {
  it("redacts sensitive headers (case-insensitive)", () => {
    const out = scrubEvent(
      event({
        request: {
          headers: {
            Authorization: "Bearer xyz",
            cookie: "session=abc",
            "X-Hub-Signature-256": "sha256=...",
            "X-Real-IP": "10.0.0.1",
          },
        },
      }),
      HINT,
    );
    expect(out?.request?.headers).toMatchObject({
      Authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      "X-Hub-Signature-256": "[REDACTED]",
      "X-Real-IP": "10.0.0.1",
    });
  });

  it("redacts query params with sensitive keys", () => {
    const out = scrubEvent(
      event({
        request: { url: "https://api.example/?token=abcd1234efgh&id=1" },
      }),
      HINT,
    );
    expect(out?.request?.url).toBe("https://api.example/?token=[REDACTED]&id=1");
  });

  it("redacts request data keys recursively", () => {
    const out = scrubEvent(
      event({
        request: {
          data: {
            email: "u@example.com",
            password: "p",
            payload: { client_secret: "s", note: "ok" },
          },
        },
      }),
      HINT,
    );
    const d = out?.request?.data as Record<string, unknown>;
    expect(d.email).toBe("u@example.com");
    expect(d.password).toBe("[REDACTED]");
    expect((d.payload as Record<string, unknown>).client_secret).toBe("[REDACTED]");
    expect((d.payload as Record<string, unknown>).note).toBe("ok");
  });

  it("always redacts cookies on the request object", () => {
    const out = scrubEvent(
      event({ request: { cookies: { session: "abc", theme: "dark" } } }),
      HINT,
    );
    expect(out?.request?.cookies).toEqual({
      session: "[REDACTED]",
      theme: "[REDACTED]",
    });
  });

  it("redacts token-shaped values (AKIA, JWT, sk_live, gh_*, secret_*)", () => {
    const out = scrubEvent(
      event({
        extra: {
          // All values below are syntactic placeholders that match the
          // scrubber's regex but are obviously not real keys — chosen this
          // way to avoid GitHub Push Protection false positives.
          aws: "AKIA" + "X".repeat(16),
          stripe: "sk_live_" + "FIXTURE".repeat(4),
          notion: "secret_" + "F".repeat(40),
          gh: "ghp_" + "F".repeat(36),
          jwt: "eyJhbGc.payload.sig",
          benign: "hello world",
        },
      }),
      HINT,
    );
    const e = out?.extra as Record<string, unknown>;
    expect(e.aws).toBe("[REDACTED]");
    expect(e.stripe).toBe("[REDACTED]");
    expect(e.notion).toBe("[REDACTED]");
    expect(e.gh).toBe("[REDACTED]");
    expect(e.jwt).toBe("[REDACTED]");
    expect(e.benign).toBe("hello world");
  });

  it("returns the event (not null) for benign payloads", () => {
    const out = scrubEvent(event({ extra: { ok: 1 } }), HINT);
    expect(out).not.toBeNull();
    expect((out?.extra as Record<string, unknown>).ok).toBe(1);
  });
});

describe("scrubBreadcrumb", () => {
  it("redacts URL query params + body keys in fetch breadcrumbs", () => {
    const bc: Breadcrumb = {
      category: "fetch",
      data: {
        url: "https://api/?api_key=xyz&page=1",
        body: { password: "p", note: "ok" },
      },
    };
    const out = scrubBreadcrumb(bc);
    const data = out?.data as Record<string, unknown>;
    expect(data.url).toBe("https://api/?api_key=[REDACTED]&page=1");
    expect((data.body as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((data.body as Record<string, unknown>).note).toBe("ok");
  });

  it("passes through breadcrumbs without data", () => {
    const out = scrubBreadcrumb({ category: "console", message: "hi" });
    expect(out?.message).toBe("hi");
  });
});
