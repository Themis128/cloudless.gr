/**
 * Tests for the generic admin-alert webhook (R8). Covers auth, payload
 * validation, and the success path — does NOT exercise the Slack/ntfy fan-out
 * (those have their own units in `admin-alerts.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(),
}));
vi.mock("@/lib/admin-alerts", () => ({
  notifyAdmin: vi.fn(async () => ({
    slack: { ok: true },
    ntfy: { ok: false, skipped: "feature_off" },
  })),
}));

import { POST } from "@/app/api/webhooks/admin-alert/route";
import { getConfig } from "@/lib/ssm-config";
import { notifyAdmin } from "@/lib/admin-alerts";

const SECRET = "test-secret-abcdef";

function req(headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest("https://cloudless.gr/api/webhooks/admin-alert", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  severity: "high" as const,
  title: "espocrm down",
  message: "5xx from /api/v1/App/user for 3min",
  click: "https://espocrm.cloudless.gr",
  source: "alert-api",
};

beforeEach(() => {
  vi.mocked(getConfig).mockReset();
  vi.mocked(notifyAdmin).mockClear();
});

describe("POST /api/webhooks/admin-alert", () => {
  it("returns 401 without the secret header", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(req({}, validBody));
    expect(res.status).toBe(401);
  });

  it("returns 503 when no secret is configured", async () => {
    vi.mocked(getConfig).mockResolvedValue({
      ADMIN_ALERT_SECRET: "",
      NOTION_WEBHOOK_SECRET: "",
    } as never);
    const res = await POST(req({ "x-cloudless-alert-secret": "anything" }, validBody));
    expect(res.status).toBe(503);
  });

  it("returns 401 when the secret doesn't match", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(req({ "x-cloudless-alert-secret": "wrong-secret-abcdef" }, validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(req({ "x-cloudless-alert-secret": SECRET }, "not json{{{"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(
      req({ "x-cloudless-alert-secret": SECRET }, { severity: "high" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on bad severity", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(
      req(
        { "x-cloudless-alert-secret": SECRET },
        { ...validBody, severity: "bogus" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("calls notifyAdmin with the prefixed title on the happy path", async () => {
    vi.mocked(getConfig).mockResolvedValue({ ADMIN_ALERT_SECRET: SECRET } as never);
    const res = await POST(req({ "x-cloudless-alert-secret": SECRET }, validBody));
    expect(res.status).toBe(200);
    expect(notifyAdmin).toHaveBeenCalledTimes(1);
    const call = vi.mocked(notifyAdmin).mock.calls[0][0];
    expect(call.title).toBe("[alert-api] espocrm down");
    expect(call.severity).toBe("high");
  });

  it("falls back to NOTION_WEBHOOK_SECRET when ADMIN_ALERT_SECRET is empty", async () => {
    vi.mocked(getConfig).mockResolvedValue({
      ADMIN_ALERT_SECRET: "",
      NOTION_WEBHOOK_SECRET: SECRET,
    } as never);
    const res = await POST(req({ "x-cloudless-alert-secret": SECRET }, validBody));
    expect(res.status).toBe(200);
  });
});
