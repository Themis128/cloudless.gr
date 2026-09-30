// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const verifyTurnstileTokenMock = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => verifyTurnstileTokenMock(...args),
}));

const recordNotificationMock = vi.fn();
vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: (...args: unknown[]) => recordNotificationMock(...args),
}));

const getConfigMock = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => getConfigMock(),
}));

const fetchMock = vi.fn();

function makeRequest(body: unknown, raw = false): Request {
  return new globalThis.Request("http://localhost:4000/api/playbook-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", referer: "https://cloudless.gr/el/playbook" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

const VALID = { email: "Jane@Example.com", name: "Jane Doe", consent: true, locale: "el" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function post(body: unknown, raw = false) {
  const { POST } = await import("@/app/api/playbook-lead/route");
  const res = await POST(makeRequest(body, raw));
  return { res, data: (await res.json()) as Record<string, unknown> };
}

describe("POST /api/playbook-lead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    getConfigMock.mockResolvedValue({
      SOCIALAUTO_SERVICE_TOKEN: "test-secret",
      SOCIALAUTO_CF_ACCESS_CLIENT_ID: "test-id.access",
      SOCIALAUTO_API_URL: "",
      SOCIALAUTO_LEADS_URL: "",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects malformed JSON with 400", async () => {
    const { res, data } = await post("{not json", true);
    expect(res.status).toBe(400);
    expect(data.code).toBe("invalid_body");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const { res, data } = await post({ ...VALID, email: "nope" });
    expect(res.status).toBe(400);
    expect(data.code).toBe("invalid_email");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires explicit consent", async () => {
    const { res, data } = await post({ ...VALID, consent: undefined });
    expect(res.status).toBe(400);
    expect(data.code).toBe("consent");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects over-long names", async () => {
    const { res } = await post({ ...VALID, name: "x".repeat(201) });
    expect(res.status).toBe(400);
  });

  it("silently accepts honeypot submissions without forwarding", async () => {
    const { res, data } = await post({ ...VALID, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
  });

  it("returns 403 when Turnstile rejects", async () => {
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, error: "Missing Turnstile token." });
    const { res, data } = await post(VALID);
    expect(res.status).toBe(403);
    expect(data.code).toBe("turnstile");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails gracefully with 503 + direct download link when the service token is unset", async () => {
    getConfigMock.mockResolvedValue({
      SOCIALAUTO_SERVICE_TOKEN: "",
      SOCIALAUTO_CF_ACCESS_CLIENT_ID: "",
    });
    const { res, data } = await post(VALID);
    expect(res.status).toBe(503);
    expect(data.code).toBe("not_configured");
    expect(data.playbookUrl).toBe("https://cloudless.gr/playbooks/cloud-migration-playbook.pdf");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards to SocialAuto with CF Access service-token headers", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: true,
        playbook_delivery: "email",
        playbook_url: "https://cloudless.gr/playbooks/cloud-migration-playbook.pdf",
      })
    );
    const { res, data } = await post(VALID);
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ success: true, delivery: "email" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://social.cloudless.gr/api/v1/leads/public");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    const headers = init.headers as Record<string, string>;
    expect(headers["Cf-Access-Client-Id"]).toBe("test-id.access");
    expect(headers["Cf-Access-Client-Secret"]).toBe("test-secret");
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({
      email: "jane@example.com",
      name: "Jane Doe",
      site: "cloudless.gr",
      form: "playbook",
      page_path: "/el/playbook",
      locale: "el",
      consent: true,
    });
    expect(typeof sent.consent_at).toBe("string");
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", route: "/api/playbook-lead" })
    );
  });

  it("accepts a combined client_id:client_secret token and a URL override", async () => {
    getConfigMock.mockResolvedValue({
      SOCIALAUTO_SERVICE_TOKEN: "combo-id.access:combo-secret",
      SOCIALAUTO_CF_ACCESS_CLIENT_ID: "",
      SOCIALAUTO_LEADS_URL: "https://internal.example/api/v1/leads/public",
    });
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, playbook_delivery: "already_sent" }));
    const { res, data } = await post(VALID);
    expect(res.status).toBe(200);
    expect(data.delivery).toBe("already_sent");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://internal.example/api/v1/leads/public");
    const headers = init.headers as Record<string, string>;
    expect(headers["Cf-Access-Client-Id"]).toBe("combo-id.access");
    expect(headers["Cf-Access-Client-Secret"]).toBe("combo-secret");
  });

  it("maps a Cloudflare Access login redirect to 502 upstream_error", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://cloudless-gr.cloudflareaccess.com/cdn-cgi/access/login/social.cloudless.gr",
        },
      })
    );
    const { res, data } = await post(VALID);
    expect(res.status).toBe(502);
    expect(data.code).toBe("upstream_error");
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: expect.stringContaining("access_denied") })
    );
  });

  it("maps upstream 5xx and network errors to 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));
    expect((await post(VALID)).res.status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect((await post(VALID)).res.status).toBe(502);
  });

  it("maps an upstream 400 to an invalid-email error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Invalid email address" }, 400));
    const { res, data } = await post(VALID);
    expect(res.status).toBe(400);
    expect(data.code).toBe("invalid_email");
  });

  it("treats a non-JSON 200 (e.g. an HTML interstitial) as an upstream error", async () => {
    fetchMock.mockResolvedValue(new Response("<html>login</html>", { status: 200 }));
    const { res } = await post(VALID);
    expect(res.status).toBe(502);
  });
});
