import { describe, it, expect } from "vitest";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";
import type { ErrorEvent, EventHint, Breadcrumb } from "@sentry/nextjs";

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { ...overrides } as ErrorEvent;
}

function makeHint(): EventHint {
  return {} as EventHint;
}

describe("scrubEvent", () => {
  it("passes event through when there is no request", () => {
    const event = makeEvent({ extra: { foo: "bar" } });
    const result = scrubEvent(event, makeHint());
    expect(result).not.toBeNull();
    if (result && typeof result === "object" && "extra" in result) {
      expect((result as ErrorEvent).extra?.foo).toBe("bar");
    }
  });

  it("redacts Authorization header", () => {
    const event = makeEvent({
      request: {
        headers: { authorization: "Bearer secret123", "content-type": "application/json" },
        url: "https://cloudless.gr/api/test",
      },
    });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.request?.headers?.authorization).toBe("[REDACTED]");
    expect(result.request?.headers?.["content-type"]).toBe("application/json");
  });

  it("redacts sensitive query params in URL", () => {
    const event = makeEvent({
      request: { url: "https://cloudless.gr/api?token=abc123&foo=bar" },
    });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.request?.url).not.toContain("abc123");
    expect(result.request?.url).toContain("foo=bar");
  });

  it("redacts sensitive keys in extra", () => {
    const event = makeEvent({ extra: { password: "mypassword", safe: "value" } });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.extra?.password).toBe("[REDACTED]");
    expect(result.extra?.safe).toBe("value");
  });

  it("redacts cookie header", () => {
    const event = makeEvent({ request: { headers: { cookie: "session_token=abc" } } });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.request?.headers?.cookie).toBe("[REDACTED]");
  });

  it("redacts request cookies", () => {
    const event = makeEvent({
      request: { cookies: { session_token: "abc", XSRF: "token" } },
    });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.request?.cookies?.session_token).toBe("[REDACTED]");
    expect(result.request?.cookies?.XSRF).toBe("[REDACTED]");
  });

  it("redacts JWT-shaped string values", () => {
    const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc";
    const event = makeEvent({ extra: { someJwt: jwt } });
    const result = scrubEvent(event, makeHint()) as ErrorEvent;
    expect(result.extra?.someJwt).toBe("[REDACTED]");
  });
});

describe("scrubBreadcrumb", () => {
  it("returns breadcrumb unchanged when no data", () => {
    const bc: Breadcrumb = { type: "default", message: "test" };
    expect(scrubBreadcrumb(bc)).toBe(bc);
  });

  it("redacts token in URL", () => {
    const bc: Breadcrumb = {
      data: { url: "https://api.example.com?token=secret&other=ok" },
    };
    const result = scrubBreadcrumb(bc);
    expect(result?.data?.url).not.toContain("secret");
    expect(result?.data?.url).toContain("other=ok");
  });

  it("redacts sensitive keys in body", () => {
    const bc: Breadcrumb = { data: { body: { password: "pw", name: "John" } } };
    const result = scrubBreadcrumb(bc);
    expect(result?.data?.body?.password).toBe("[REDACTED]");
    expect(result?.data?.body?.name).toBe("John");
  });
});
