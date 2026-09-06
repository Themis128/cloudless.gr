import { describe, it, expect } from "vitest";
import { buildTikTokAuthUrl } from "@/lib/tiktok-oauth";

describe("buildTikTokAuthUrl", () => {
  it("builds a valid URL with required params", () => {
    const url = buildTikTokAuthUrl("app123", "https://example.com/callback", "csrf-state");
    expect(url).toContain("app_id=app123");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=csrf-state");
    expect(url).toContain("response_type=code");
    expect(url.startsWith("https://business-api.tiktok.com/portal/auth")).toBe(true);
  });
});
