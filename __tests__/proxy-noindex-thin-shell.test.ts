import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (opts: unknown) => mockGetToken(opts) }));

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

import { proxy } from "@/proxy";

const req = (p: string) =>
  new NextRequest(`http://localhost:4000${p}`, { headers: { "x-forwarded-for": "1.2.3.4" } });

describe("proxy thin-shell noindex", () => {
  it("sets X-Robots-Tag on admin shell", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await proxy(req("/en/admin/socialauto"));
    expect(res?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
  it("sets X-Robots-Tag on auth shell without locale", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await proxy(req("/auth/login"));
    expect(res?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
  it("leaves public pages indexable", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await proxy(req("/en/services"));
    expect(res?.headers.get("X-Robots-Tag")).toBeNull();
  });
});
