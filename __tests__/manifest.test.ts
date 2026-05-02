import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/pwa-manifest/route";

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface ManifestShortcut {
  url: string;
  name?: string;
  short_name?: string;
}

interface Manifest {
  name?: string;
  short_name?: string;
  display?: string;
  start_url?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
}

async function fetchManifest(): Promise<Manifest> {
  const res = GET(new NextRequest("http://localhost/manifest.webmanifest"));
  return (await res.json()) as Manifest;
}

describe("web app manifest", () => {
  it("defines stable core metadata", async () => {
    const data = await fetchManifest();

    expect(data.name).toContain("Cloudless");
    expect(data.short_name).toBe("Cloudless");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.theme_color).toBe("#0a0a0f");
    expect(data.background_color).toBe("#0a0a0f");
  });

  it("references expected app icons with correct MIME and sizes", async () => {
    const data = await fetchManifest();
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

  it("contains key navigation shortcuts", async () => {
    const data = await fetchManifest();
    const urls = new Set((data.shortcuts ?? []).map((item) => item.url));

    expect(urls.has("/contact")).toBe(true);
    expect(urls.has("/services")).toBe(true);
    expect(urls.has("/blog")).toBe(true);
  });

  it("returns the manifest+json content type so PWA clients accept it", async () => {
    const res = GET(new NextRequest("http://localhost/manifest.webmanifest"));
    expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
  });
});
