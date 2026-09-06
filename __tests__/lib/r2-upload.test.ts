import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    fetch = mockFetch;
  },
}));

import { createR2ClientFromEnv, r2ObjectUrl, r2PutObject, r2GetObject } from "@/lib/r2-upload";

beforeEach(() => {
  mockFetch.mockClear();
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
  process.env.CF_R2_ACCESS_KEY_ID = "key123";
  process.env.CF_R2_SECRET_ACCESS_KEY = "secret123";
});

afterEach(() => {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CF_R2_ACCESS_KEY_ID;
  delete process.env.CF_R2_SECRET_ACCESS_KEY;
});

describe("createR2ClientFromEnv", () => {
  it("returns an AwsClient when credentials are configured", () => {
    const client = createR2ClientFromEnv();
    expect(client).toBeDefined();
    expect(typeof client.fetch).toBe("function");
  });

  it("throws when CLOUDFLARE_ACCOUNT_ID is missing", () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    expect(() => createR2ClientFromEnv()).toThrow(/Missing R2 credentials/);
  });

  it("throws when access key is missing", () => {
    delete process.env.CF_R2_ACCESS_KEY_ID;
    expect(() => createR2ClientFromEnv()).toThrow(/Missing R2 credentials/);
  });
});

describe("r2ObjectUrl", () => {
  it("builds the correct URL with encoded key parts", () => {
    const url = r2ObjectUrl("reports/2026/my file.json", "my-bucket");
    expect(url).toBe("https://acct123.r2.cloudflarestorage.com/my-bucket/reports/2026/my%20file.json");
  });

  it("encodes special characters in the path", () => {
    const url = r2ObjectUrl("path/key with spaces/file.txt", "bucket");
    expect(url).toContain("key%20with%20spaces");
  });
});

describe("r2PutObject", () => {
  it("calls fetch with PUT method and correct URL", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await r2PutObject({ bucket: "my-bucket", key: "test.json", body: '{"a":1}', contentType: "application/json" });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toContain("my-bucket/test.json");
    expect((init as { method: string }).method).toBe("PUT");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => "Forbidden" });
    await expect(
      r2PutObject({ bucket: "b", key: "k", body: "data" })
    ).rejects.toThrow(/403/);
  });

  it("uses application/octet-stream as default content-type", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await r2PutObject({ bucket: "b", key: "k", body: Buffer.from("data") });
    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/octet-stream");
  });
});

describe("r2GetObject", () => {
  it("returns buffer on success", async () => {
    const ab = new TextEncoder().encode("hello").buffer;
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => ab,
    });
    const result = await r2GetObject({ bucket: "b", key: "k" });
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("hello");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => "Not Found" });
    await expect(r2GetObject({ bucket: "b", key: "k" })).rejects.toThrow(/404/);
  });
});
