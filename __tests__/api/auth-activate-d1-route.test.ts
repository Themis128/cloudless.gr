/** api/auth/activate-d1 — real HMAC token+OTP verification, D1 faked. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  getDb: vi.fn(),
  run: vi.fn(async () => ({ success: true })),
  rateLimit: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: m.getDb }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  getClientIp: vi.fn(() => "1.2.3.4"),
}));
vi.mock("@/lib/canonical-origin", () => ({ canonicalOrigin: () => "https://cloudless.gr" }));

import { GET, POST } from "@/app/api/auth/activate-d1/route";

const SECRET = "test-secret-123";

async function hmacB64(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintToken(email: string, expOffset = 60_000): Promise<string> {
  const nonce = "nonce123";
  const exp = Date.now() + expOffset;
  const sig = await hmacB64(`${email}:${exp}:${nonce}`);
  return `${nonce}.${exp}.${sig}`;
}

async function mintOtp(email: string, token: string): Promise<string> {
  const [nonce, expStr] = token.split(".");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const full = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`otp:${email}:${expStr}:${nonce}`)
  ));
  const hex = Array.from(full).map((b) => "00".concat(b.toString(16)).slice(-2)).join("");
  return (parseInt(hex.slice(0, 8), 16) % 1_000_000).toString().padStart(6, "0");
}

const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: m.run })) })) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", SECRET);
  m.getDb.mockReturnValue(db);
  m.run.mockResolvedValue({ success: true });
});

describe("GET activate-d1", () => {
  const get = (q: string) => GET(new NextRequest(`https://x/api/auth/activate-d1?${q}`));

  it("invalid token → signup?activated=invalid redirect", async () => {
    const r = await get("email=a@b.c&token=bad.token.here");
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("https://cloudless.gr/en/auth/signup?activated=invalid");
  });

  it("expired token → invalid; missing params → invalid", async () => {
    const expired = await mintToken("a@b.c", -1000);
    const r = await get(`email=a@b.c&token=${expired}`);
    expect(r.headers.get("location")).toContain("activated=invalid");
    expect((await get("")).headers.get("location")).toContain("activated=invalid");
  });

  it("no db → activated=error", async () => {
    m.getDb.mockReturnValue(null);
    const token = await mintToken("a@b.c");
    const r = await get(`email=a@b.c&token=${token}`);
    expect(r.headers.get("location")).toBe("https://cloudless.gr/en/auth/signup?activated=error");
  });

  it("valid token → update + login?activated=1; db throw swallowed", async () => {
    const token = await mintToken("a@b.c");
    const r = await get(`email=a@b.c&token=${token}`);
    expect(r.headers.get("location")).toBe("https://cloudless.gr/en/auth/login?activated=1");
    expect(db.prepare).toHaveBeenCalled();

    m.run.mockRejectedValueOnce(new Error("write fail"));
    const r2 = await get(`email=a@b.c&token=${await mintToken("a@b.c")}`);
    expect(r2.headers.get("location")).toContain("activated=1"); // still redirects
  });
});

describe("POST activate-d1", () => {
  const post = (body: unknown) => POST(new NextRequest("https://x/api/auth/activate-d1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

  it("503 without db; 400 malformed body; 400 missing fields", async () => {
    m.getDb.mockReturnValue(null);
    expect((await post({})).status).toBe(503);
    m.getDb.mockReturnValue(db);
    expect((await post("{bad")).status).toBe(400);
    expect((await post({ email: "a@b.c" })).status).toBe(400);
  });

  it("wrong otp → 400; correct otp → {ok:true}; db fail → 500", async () => {
    const token = await mintToken("a@b.c");
    const wrong = await post({ email: "a@b.c", otp: "000000", token });
    // either wrong OTP → 400 (or coincidentally right — assert on real computed otp)
    const otp = await mintOtp("a@b.c", token);
    if (otp === "000000") {
      expect((await wrong.json()).ok).toBe(true);
    } else {
      expect(wrong.status).toBe(400);
    }

    const good = await post({ email: "a@b.c", otp, token });
    expect((await good.json()).ok).toBe(true);

    m.run.mockRejectedValueOnce(new Error("db down"));
    const bad = await post({ email: "a@b.c", otp, token });
    expect(bad.status).toBe(500);
  });
});
