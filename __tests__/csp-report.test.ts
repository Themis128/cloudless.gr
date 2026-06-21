import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { NextRequest } from "next/server";

function jsonRequest(body: unknown, contentType = "application/csp-report"): NextRequest {
  return new NextRequest("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

describe("/api/csp-report", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns 204 and logs a single line for legacy report-uri payloads", async () => {
    const res = await POST(
      jsonRequest({
        "csp-report": {
          "document-uri": "https://cloudless.gr/en",
          "violated-directive": "script-src",
          "effective-directive": "script-src",
          "blocked-uri": "https://evil.example/inline.js",
          "source-file": "https://cloudless.gr/en",
          "line-number": 42,
          disposition: "report",
        },
      })
    );

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toContain("[csp-violation]");
    expect(line).toContain("dir=script-src");
    expect(line).toContain("blocked=https://evil.example/inline.js");
    expect(line).toContain("doc=https://cloudless.gr/en");
    expect(line).toContain("disp=report");
  });

  it("handles modern Reporting-API payloads (array of csp-violation entries)", async () => {
    const res = await POST(
      jsonRequest(
        [
          {
            type: "csp-violation",
            url: "https://cloudless.gr/en",
            body: {
              documentURL: "https://cloudless.gr/en",
              effectiveDirective: "img-src",
              blockedURL: "https://tracker.example/pixel.gif",
              disposition: "enforce",
            },
          },
          {
            type: "deprecation",
            url: "https://cloudless.gr/en",
          },
        ],
        "application/reports+json"
      )
    );

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1); // only csp-violation gets logged, deprecation skipped
    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).toContain("dir=img-src");
    expect(line).toContain("blocked=https://tracker.example/pixel.gif");
    expect(line).toContain("disp=enforce");
  });

  it("handles malformed JSON gracefully (returns 204, no log)", async () => {
    const req = new NextRequest("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles unknown payload shapes (no log, no error)", async () => {
    const res = await POST(jsonRequest({ unexpected: "shape" }));
    expect(res.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs each modern entry but only csp-violation type", async () => {
    const res = await POST(
      jsonRequest(
        [
          { type: "csp-violation", body: { effectiveDirective: "style-src", blockedURL: "a" } },
          { type: "csp-violation", body: { effectiveDirective: "font-src", blockedURL: "b" } },
          { type: "intervention", body: {} },
        ],
        "application/reports+json"
      )
    );
    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
