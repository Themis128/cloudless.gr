import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("defines stable core metadata", () => {
    const data = manifest();

    expect(data.name).toContain("Cloudless");
    expect(data.short_name).toBe("Cloudless");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.theme_color).toBe("#0a0a0f");
    expect(data.background_color).toBe("#0a0a0f");
  });

  it("references expected app icons with correct MIME and sizes", () => {
    const data = manifest();
    const icon192 = data.icons?.find((icon) => icon.src === "/icons/icon-192.png");
    const icon512 = data.icons?.find((icon) => icon.src === "/icons/icon-512.png");
    const maskable = data.icons?.find((icon) => icon.src === "/icons/icon-512-maskable.png");

    expect(icon192).toMatchObject({ type: "image/png", sizes: "192x192" });
    expect(icon512).toMatchObject({ type: "image/png", sizes: "512x512" });
    expect(maskable).toMatchObject({
      type: "image/png",
      sizes: "512x512",
      purpose: "maskable",
    });
  });

  it("contains key navigation shortcuts", () => {
    const data = manifest();
    const urls = new Set((data.shortcuts ?? []).map((item) => item.url));

    expect(urls.has("/contact")).toBe(true);
    expect(urls.has("/services")).toBe(true);
    expect(urls.has("/blog")).toBe(true);
  });
});
