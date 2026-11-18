// @vitest-environment node
/**
 * app icon generators — apple-icon + icon ImageResponse PNGs.
 * Node environment: @vercel/og renders through sharp, which rejects
 * jsdom-realm Uint8Array input, and the suite needs the real fetch
 * (components-tail3 stubs it for the component tests).
 */
import { describe, expect, it } from "vitest";

import AppleIcon from "@/app/apple-icon";
import SiteIcon from "@/app/icon";

describe("app icons", () => {
  it("apple-icon renders a real PNG at 180×180", async () => {
    const res = AppleIcon();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it("icon renders a real PNG at 32×32", async () => {
    const res = SiteIcon();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(200);
  });
});
