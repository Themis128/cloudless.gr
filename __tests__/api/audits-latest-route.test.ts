/** api/admin/audits/latest — GH API fetches faked; real in-memory zip parse. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { deflateRawSync } from "node:zlib";

const m = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: m.requireAdmin }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/admin/audits/latest/route";

const req = () => new NextRequest("http://x/api/admin/audits/latest");

/** Minimal zip with one entry (deflate or stored) — matches extractJsonFromZip. */
function buildZip(name: string, content: string, method: 0 | 8 = 8): Buffer {
  const data = method === 8 ? deflateRawSync(content) : Buffer.from(content);
  const nameBuf = Buffer.from(name);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4); // version
  lh.writeUInt16LE(0, 6); // flags
  lh.writeUInt16LE(method, 8);
  lh.writeUInt32LE(0, 10); // time+date
  lh.writeUInt32LE(0, 18); // crc (unchecked by parser)
  lh.writeUInt32LE(data.length, 18);
  lh.writeUInt32LE(Buffer.byteLength(content), 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28); // extra len
  const local = Buffer.concat([lh, nameBuf, data]);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt32LE(0, 12);
  cd.writeUInt32LE(0, 16);
  cd.writeUInt32LE(data.length, 20);
  cd.writeUInt32LE(Buffer.byteLength(content), 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(0, 42); // localHeaderOffset = 0
  const central = Buffer.concat([cd, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, central, eocd]);
}

const ghJson = (body: unknown, ok = true, status = 200, statusText = "OK") => ({
  ok, status, statusText, json: async () => body,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockResolvedValue({ ok: true });
  vi.stubEnv("GH_AUDITS_TOKEN", "ghp_test");
});

describe("GET /api/admin/audits/latest", () => {
  it("non-admin → auth response; no token → 503", async () => {
    m.requireAdmin.mockResolvedValueOnce({
      ok: false, response: Response.json({ e: 1 }, { status: 401 }),
    });
    expect((await GET(req())).status).toBe(401);

    vi.stubEnv("GH_AUDITS_TOKEN", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    expect((await GET(req())).status).toBe(503);
  });

  it("no successful runs → 404; artifact missing → 404", async () => {
    mockFetch.mockResolvedValueOnce(ghJson({ workflow_runs: [] }));
    expect((await GET(req())).status).toBe(404);

    mockFetch
      .mockResolvedValueOnce(ghJson({ workflow_runs: [{ id: 7 }] }))
      .mockResolvedValueOnce(ghJson({ artifacts: [{ id: 1, name: "other" }] }));
    expect((await GET(req())).status).toBe(404);
  });

  it("full path → parsed dashboard.json (deflate + stored)", async () => {
    for (const method of [8, 0] as const) {
      mockFetch.mockReset();
      const zip = buildZip("dashboard.json", `{"lighthouse":${method}}`, method);
      mockFetch
        .mockResolvedValueOnce(ghJson({ workflow_runs: [{ id: 7 }] }))
        .mockResolvedValueOnce(ghJson({
          artifacts: [{ id: 1, name: "audits-dashboard-1", archive_download_url: "https://gh/zip" }],
        }))
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => zip });
      const r = await GET(req());
      expect((await r.json()).lighthouse).toBe(method);
      expect(r.headers.get("cache-control")).toContain("max-age=60");
    }
  });

  it("download non-ok → 502; zip without entry → 502; GH error → 500", async () => {
    mockFetch
      .mockResolvedValueOnce(ghJson({ workflow_runs: [{ id: 7 }] }))
      .mockResolvedValueOnce(ghJson({
        artifacts: [{ id: 1, name: "audits-dashboard-1", archive_download_url: "u" }],
      }))
      .mockResolvedValueOnce({ ok: false, status: 403 });
    expect((await GET(req())).status).toBe(502);

    mockFetch
      .mockResolvedValueOnce(ghJson({ workflow_runs: [{ id: 7 }] }))
      .mockResolvedValueOnce(ghJson({
        artifacts: [{ id: 1, name: "audits-dashboard-1", archive_download_url: "u" }],
      }))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => buildZip("other.json", "{}") });
    expect((await GET(req())).status).toBe(502);

    mockFetch.mockReset().mockResolvedValue(ghJson({}, false, 500, "ISE"));
    expect((await GET(req())).status).toBe(500);
  });
});
