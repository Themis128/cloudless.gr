import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: (...a: unknown[]) => mockGetConfig(...a) }));
vi.mock("server-only", () => ({}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "../../src/app/api/audit/route";
import { resetRateLimitStore } from "../../src/lib/rate-limit";

let ipCounter = 0;

function req(body: unknown, ip?: string) {
  return new Request("http://localhost/api/audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Each case gets its own IP so the shared rate-limit window never
      // bleeds between assertions.
      "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Ana",
  email: "ana@x.co",
  goal: "automate lead intake",
  pain: "manual data entry",
  timeline: "next month",
  consent: true,
};

const CFG = { SOCIALAUTO_SERVICE_TOKEN: "cid:csecret" };

const ack = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  mockGetConfig.mockResolvedValue(CFG);
  // Fresh Response per call — a shared one has its body consumed after the first read.
  mockFetch.mockImplementation(async () => ack());
});

describe("/api/audit POST", () => {
  it("400 on invalid JSON", async () => {
    expect((await POST(req("{oops"))).status).toBe(400);
    expect((await POST(req("null"))).status).toBe(400);
  });

  it("400 on missing/invalid email", async () => {
    expect((await POST(req({ ...valid, email: "nope" }))).status).toBe(400);
    expect((await POST(req({ ...valid, email: "" }))).status).toBe(400);
    expect((await POST(req({ ...valid, email: 42 }))).status).toBe(400);
  });

  it("400 when a discovery field is missing", async () => {
    for (const key of ["goal", "pain", "timeline"] as const) {
      expect((await POST(req({ ...valid, [key]: "  " }))).status).toBe(400);
    }
  });

  it("400 (not a TypeError) when a field is not a string", async () => {
    for (const key of ["goal", "pain", "timeline"] as const) {
      const res = await POST(req({ ...valid, [key]: { nope: true } }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: `${key} must be a string` });
    }
    expect((await POST(req({ ...valid, name: 7 }))).status).toBe(400);
  });

  it("400 when an over-long field is submitted", async () => {
    expect((await POST(req({ ...valid, goal: "x".repeat(1001) }))).status).toBe(400);
    expect((await POST(req({ ...valid, name: "x".repeat(201) }))).status).toBe(400);
  });

  it("400 without explicit consent — and never forwards", async () => {
    for (const consent of [undefined, false, "yes"]) {
      const res = await POST(req({ ...valid, consent }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "consent is required" });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards a valid lead as form=audit-request with CF Access headers", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/leads/public");
    // SocialAuto is behind Cloudflare Access: the service token must be sent
    // and the Access login redirect must never be followed.
    const headers = init.headers as Record<string, string>;
    expect(headers["Cf-Access-Client-Id"]).toBe("cid");
    expect(headers["Cf-Access-Client-Secret"]).toBe("csecret");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeDefined();

    const sent = JSON.parse(init.body as string);
    expect(sent.form).toBe("audit-request");
    expect(sent.interest).toBe("audit");
    expect(sent.email).toBe(valid.email);
    expect(sent.consent).toBe(true);
    expect(typeof sent.consent_at).toBe("string");
    expect(sent.message).toContain(valid.goal);
    expect(sent.message).toContain(valid.pain);
    expect(sent.message).toContain(valid.timeline);
  });

  it("uses the name fallback when name is empty", async () => {
    await POST(req({ ...valid, name: " " }));
    const sent = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.name).toBe("ana");
  });

  it("forwards the supported locale and the referer page path", async () => {
    const request = req({ ...valid, locale: "el" });
    request.headers.set("referer", "https://cloudless.gr/el/audit?utm=x");
    await POST(request);
    const sent = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.locale).toBe("el");
    expect(sent.page_path).toBe("/el/audit");
  });

  it("drops an unsupported locale and an unparsable referer", async () => {
    const request = req({ ...valid, locale: "klingon" });
    request.headers.set("referer", "not a url");
    await POST(request);
    const sent = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.locale).toBeUndefined();
    expect(sent.page_path).toBeUndefined();
  });

  it("fires the confirmation mail only when the mail worker is configured", async () => {
    await POST(req(valid));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.stubEnv("MAIL_OUTBOUND_URL", "https://mail.example/");
    vi.stubEnv("MAIL_OUTBOUND_TOKEN", "tok");
    try {
      mockFetch.mockClear();
      await POST(req(valid));
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [mailUrl, mailInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(mailUrl).toBe("https://mail.example/send");
      const mail = JSON.parse(mailInit.body as string);
      expect(mail.to).toBe(valid.email);
      expect(mail.category).toBe("audit-confirm");
      expect(mail.text).toContain("Hi Ana");
      expect(mail.text).toContain(valid.goal);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("a confirmation-mail failure never breaks the booking", async () => {
    vi.stubEnv("MAIL_OUTBOUND_URL", "https://mail.example");
    vi.stubEnv("MAIL_OUTBOUND_TOKEN", "tok");
    try {
      mockFetch
        .mockImplementationOnce(async () => ack())
        .mockImplementationOnce(async () => {
          throw new Error("mail down");
        });
      expect((await POST(req({ ...valid, name: "" }))).status).toBe(200);
      const mail = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
      expect(mail.text).toContain("Hi,");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("acks the honeypot without forwarding", async () => {
    const res = await POST(req({ ...valid, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rate-limits after 5 attempts from the same IP", async () => {
    const ip = "203.0.113.9";
    for (let i = 0; i < 5; i++) {
      expect((await POST(req(valid, ip))).status).toBe(200);
    }
    const res = await POST(req(valid, ip));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("503 when the Access service token is not configured — no unauthenticated call", async () => {
    mockGetConfig.mockResolvedValue({});
    expect((await POST(req(valid))).status).toBe(503);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("502 when the upstream bounces to the Access login page", async () => {
    mockFetch.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://cloudless.cloudflareaccess.com/cdn-cgi/access/login" },
      })
    );
    expect((await POST(req(valid))).status).toBe(502);
  });

  it("502 when the upstream answers 200 with a non-JSON body", async () => {
    mockFetch.mockResolvedValue(new Response("<html>login</html>", { status: 200 }));
    expect((await POST(req(valid))).status).toBe(502);
  });

  it("502 when the upstream API rejects", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await POST(req(valid))).status).toBe(502);
  });

  it("400 when the upstream rejects the payload", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 422 }));
    expect((await POST(req(valid))).status).toBe(400);
  });

  it("502 when the upstream request throws (timeout/network)", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    expect((await POST(req(valid))).status).toBe(502);
  });
});
