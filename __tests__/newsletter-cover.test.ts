import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNewsletterCover } from "@/lib/newsletter-cover";

const PNG_BYTES = new ArrayBuffer(2048);

function pngResponse(): Response {
  return new Response(PNG_BYTES, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

describe("fetchNewsletterCover", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NEWSLETTER_SERVICE_TOKEN = "test-token";
    process.env.SOCIALAUTO_API_URL = "https://social.cloudless.gr";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the cover buffer on a PNG 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pngResponse());
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchNewsletterCover({
      title: "Workers AI pipelines",
      slug: "2026-10-12-issue",
      category: "Cloud",
      date: "2026-10-12",
    });

    expect(out).not.toBeNull();
    expect(new Uint8Array(out!.buffer)).toEqual(new Uint8Array(PNG_BYTES));
    expect(out?.slug).toBe("2026-10-12-issue");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://social.cloudless.gr/api/v1/newsletter/cover");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Service-Token"]).toBe("test-token");
    const body = JSON.parse(init.body);
    expect(body.title).toBe("Workers AI pipelines");
    expect(body.issue_date).toBe("2026-10-12");
  });

  it("returns null when NEWSLETTER_SERVICE_TOKEN is unset (fetch never called)", async () => {
    delete process.env.NEWSLETTER_SERVICE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchNewsletterCover({ title: "x", slug: "s" });

    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on non-2xx (auth failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
    const out = await fetchNewsletterCover({ title: "x", slug: "s" });
    expect(out).toBeNull();
  });

  it("returns null when the content type is not PNG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("html", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )
    );
    const out = await fetchNewsletterCover({ title: "x", slug: "s" });
    expect(out).toBeNull();
  });

  it("returns null on a suspiciously tiny payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new ArrayBuffer(10), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
    );
    const out = await fetchNewsletterCover({ title: "x", slug: "s" });
    expect(out).toBeNull();
  });

  it("returns null when fetch throws (SocialAuto unreachable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns fail")));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await fetchNewsletterCover({ title: "x", slug: "s" });
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });
});
