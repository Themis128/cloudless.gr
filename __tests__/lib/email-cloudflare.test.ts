import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCloudflareEmailConfigured, sendEmailCloudflare } from "@/lib/email-cloudflare";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_EMAIL_API_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCloudflareEmailConfigured", () => {
  it("returns false when both env vars are missing", () => {
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns false when only CLOUDFLARE_ACCOUNT_ID is set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns false when only CLOUDFLARE_EMAIL_API_TOKEN is set", () => {
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token123";
    expect(isCloudflareEmailConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token123";
    expect(isCloudflareEmailConfigured()).toBe(true);
  });
});

describe("sendEmailCloudflare", () => {
  const opts = {
    to: "user@example.com",
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
  };

  it("throws when env vars are not configured", async () => {
    await expect(sendEmailCloudflare(opts)).rejects.toThrow(
      /CLOUDFLARE_ACCOUNT_ID/
    );
  });

  it("sends POST to Cloudflare API with correct payload", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    await sendEmailCloudflare(opts);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toContain("acct123");
    expect(url).toContain("email/sending/send");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("user@example.com");
    expect(body.subject).toBe("Hello");
  });

  it("includes reply_to when replyTo is set", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    await sendEmailCloudflare({ ...opts, replyTo: ["reply@example.com"] });

    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reply_to).toBe("reply@example.com");
  });

  it("includes List-Unsubscribe header when listUnsubscribeUrl is set", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_EMAIL_API_TOKEN = "token-abc";

    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });

    await sendEmailCloudflare({ ...opts, listUnsubscribeUrl: "https://cloudless.gr/unsub" });

    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.headers["List-Unsubscribe"]).toContain("cloudless.gr");
  });
});
