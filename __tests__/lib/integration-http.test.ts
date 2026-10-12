import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IntegrationError,
  isIntegrationError,
  integrationFetch,
  integrationFetchWithMeta,
} from "@/lib/integration-http";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(body: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errResponse(status: number, body = "Error"): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => null,
    text: async () => body,
  } as unknown as Response;
}

describe("IntegrationError", () => {
  it("has correct name, integration, status, body", () => {
    const err = new IntegrationError("espocrm", 404, "Not found");
    expect(err.name).toBe("IntegrationError");
    expect(err.integration).toBe("espocrm");
    expect(err.status).toBe(404);
    expect(err.body).toBe("Not found");
  });

  it("uses custom message when provided", () => {
    const err = new IntegrationError("test", 500, "body", "Custom error");
    expect(err.message).toBe("Custom error");
  });

  it("auto-generates message from fields", () => {
    const err = new IntegrationError("test", 403, "forbidden");
    expect(err.message).toContain("test");
    expect(err.message).toContain("403");
  });
});

describe("isIntegrationError", () => {
  it("returns true for IntegrationError instances", () => {
    const err = new IntegrationError("test", 500, "body");
    expect(isIntegrationError(err)).toBe(true);
  });

  it("returns false for plain errors", () => {
    expect(isIntegrationError(new Error("plain"))).toBe(false);
  });

  it("returns true when status matches", () => {
    const err = new IntegrationError("test", 404, "body");
    expect(isIntegrationError(err, 404)).toBe(true);
  });

  it("returns false when status does not match", () => {
    const err = new IntegrationError("test", 404, "body");
    expect(isIntegrationError(err, 500)).toBe(false);
  });
});

describe("integrationFetch", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue(okResponse({ id: 1, name: "test" }));
    const result = await integrationFetch<{ id: number; name: string }>(
      "test", "https://api.example.com/endpoint", undefined, { maxRetries: 0 }
    );
    expect(result.id).toBe(1);
    expect(result.name).toBe("test");
  });

  it("throws IntegrationError on 4xx", async () => {
    mockFetch.mockResolvedValue(errResponse(404, "Not Found"));
    await expect(
      integrationFetch("test", "https://api.example.com/endpoint", undefined, { maxRetries: 0 })
    ).rejects.toThrow(IntegrationError);
  });

  it("throws IntegrationError on 5xx when maxRetries is 0", async () => {
    mockFetch.mockResolvedValue(errResponse(500, "Internal Server Error"));
    await expect(
      integrationFetch("test", "https://api.example.com/endpoint", undefined, { maxRetries: 0 })
    ).rejects.toThrow(IntegrationError);
  });

  it("passes passthroughErrors response data through without throwing", async () => {
    mockFetch.mockResolvedValue(errResponse(409, "Conflict"));
    const result = await integrationFetch("test", "https://api.example.com/endpoint", undefined, {
      passthroughErrors: true,
      maxRetries: 0,
    });
    expect(result).toBeNull();
  });
});

describe("integrationFetchWithMeta", () => {
  it("returns data with latencyMs and retries metadata", async () => {
    mockFetch.mockResolvedValue(okResponse({ ok: true }));
    const result = await integrationFetchWithMeta(
      "test", "https://api.example.com/endpoint", undefined, { maxRetries: 0 }
    );
    expect(result.data).toEqual({ ok: true });
    expect(typeof result.latencyMs).toBe("number");
    expect(result.retries).toBe(0);
  });

  it("returns status 204 with undefined data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    } as unknown as Response);
    const result = await integrationFetchWithMeta(
      "test", "https://api.example.com/endpoint", undefined, { maxRetries: 0 }
    );
    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });
});

describe("integrationFetch tails", () => {
  const resp429 = (retryAfter: string | null): Response =>
    ({
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === "Retry-After" ? retryAfter : null) },
      json: async () => null,
      text: async () => "rate limited",
    }) as unknown as Response;

  it("honors a numeric Retry-After on 429 then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(resp429("0"))
      .mockResolvedValueOnce(okResponse({ done: true }));
    const result = await integrationFetchWithMeta("svc", "https://x", undefined, {
      maxRetries: 1,
      backoffMs: 1,
    });
    expect(result.data).toEqual({ done: true });
    expect(result.retries).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("parses an HTTP-date Retry-After header", async () => {
    const future = new Date(Date.now() - 60_000).toUTCString();
    mockFetch
      .mockResolvedValueOnce(resp429(future))
      .mockResolvedValueOnce(okResponse({ ok: 1 }));
    const result = await integrationFetch("svc", "https://x", undefined, {
      maxRetries: 1,
      backoffMs: 1,
    });
    expect(result).toEqual({ ok: 1 });
  });

  it("ignores an unparseable Retry-After and uses exponential backoff", async () => {
    mockFetch
      .mockResolvedValueOnce(resp429("not-a-date"))
      .mockResolvedValueOnce(okResponse({ ok: 2 }));
    const result = await integrationFetch("svc", "https://x", undefined, {
      maxRetries: 1,
      backoffMs: 1,
    });
    expect(result).toEqual({ ok: 2 });
  });

  it("passthroughErrors returns null data when the error body is not JSON", async () => {
    const broken = {
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: async () => {
        throw new Error("html body");
      },
      text: async () => "<html>bad gateway</html>",
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(broken);
    const result = await integrationFetchWithMeta<{ e: string }>("svc", "https://x", undefined, {
      maxRetries: 0,
      passthroughErrors: true,
    });
    expect(result.data).toBeNull();
    expect(result.status).toBe(502);
  });
});
