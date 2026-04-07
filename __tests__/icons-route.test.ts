import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import { GET } from "@/app/icons/[name]/route";

describe("icons route", () => {
  let tempRoot: string | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();

    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("returns 404 for unknown icon names", async () => {
    const response = await GET(new Request("http://localhost/icons/unknown.png"), {
      params: Promise.resolve({ name: "unknown.png" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns requested icon with immutable cache headers when file exists", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "icons-route-"));
    const faviconsDir = path.join(tempRoot, "brand", "favicons");
    await mkdir(faviconsDir, { recursive: true });
    const expectedBytes = Buffer.from([1, 2, 3, 4]);
    await writeFile(path.join(faviconsDir, "android-chrome-192x192.png"), expectedBytes);

    vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

    const response = await GET(new Request("http://localhost/icons/icon-192.png"), {
      params: Promise.resolve({ name: "icon-192.png" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");

    const body = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it("returns fallback png when branded icon files are unavailable", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "icons-route-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

    const response = await GET(new Request("http://localhost/icons/icon-192.png"), {
      params: Promise.resolve({ name: "icon-192.png" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
  });
});
