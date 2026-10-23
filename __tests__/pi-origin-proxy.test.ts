import { describe, expect, it } from "vitest";
import {
  buildForwardHeaders,
  buildResponseHeaders,
  isCacheable,
  isResponseCacheable,
  isWebSocketUpgrade,
  wantsMarkdown,
  isHtmlResponse,
  toMarkdownResponse,
  REQUEST_HOP_BY_HOP,
  RESPONSE_HOP_BY_HOP,
  IDEMPOTENT,
} from "../workers/pi-origin-proxy/src/index";

const ORIGIN_HOST = "pi-origin.cloudless.gr";

function makeRequest(url: string, headers: Record<string, string> = {}, method = "GET"): Request {
  return new Request(url, { method, headers });
}

describe("pi-origin-proxy: hop-by-hop constant sets", () => {
  it("strips CF-injected + hop-by-hop headers from the forwarded request", () => {
    for (const h of ["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "cf-connecting-ip", "cf-ray", "cf-visitor"]) {
      expect(REQUEST_HOP_BY_HOP.has(h)).toBe(true);
    }
  });

  it("strips hop-by-hop headers from the response", () => {
    for (const h of ["connection", "keep-alive", "transfer-encoding", "upgrade"]) {
      expect(RESPONSE_HOP_BY_HOP.has(h)).toBe(true);
    }
  });

  it("marks GET/HEAD/OPTIONS as idempotent", () => {
    expect(IDEMPOTENT.has("GET")).toBe(true);
    expect(IDEMPOTENT.has("HEAD")).toBe(true);
    expect(IDEMPOTENT.has("OPTIONS")).toBe(true);
    expect(IDEMPOTENT.has("POST")).toBe(false);
  });
});

describe("pi-origin-proxy: isWebSocketUpgrade", () => {
  it("returns true for websocket upgrade requests", () => {
    const req = makeRequest("https://cloudless.gr/ws", { Upgrade: "websocket" });
    expect(isWebSocketUpgrade(req)).toBe(true);
  });

  it("is case-insensitive on the header value", () => {
    const req = makeRequest("https://cloudless.gr/ws", { Upgrade: "WebSocket" });
    expect(isWebSocketUpgrade(req)).toBe(true);
  });

  it("returns false when Upgrade is absent", () => {
    const req = makeRequest("https://cloudless.gr/");
    expect(isWebSocketUpgrade(req)).toBe(false);
  });

  it("returns false for non-websocket Upgrade values", () => {
    const req = makeRequest("https://cloudless.gr/", { Upgrade: "h2c" });
    expect(isWebSocketUpgrade(req)).toBe(false);
  });
});

describe("pi-origin-proxy: buildForwardHeaders", () => {
  it("sets Host, X-Forwarded-Host, X-Forwarded-Proto to proxy identity", () => {
    const url = new URL("https://cloudless.gr/some/path");
    const req = makeRequest(url.toString(), { "user-agent": "test" });
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, false);

    expect(headers.get("Host")).toBe(ORIGIN_HOST);
    expect(headers.get("X-Forwarded-Host")).toBe("cloudless.gr");
    expect(headers.get("X-Forwarded-Proto")).toBe("https");
    expect(headers.get("user-agent")).toBe("test");
  });

  it("strips hop-by-hop and CF headers by default", () => {
    const url = new URL("https://cloudless.gr/");
    const req = makeRequest(url.toString(), {
      Connection: "keep-alive",
      Upgrade: "websocket",
      "CF-Ray": "abc123",
    });
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, false);

    expect(headers.get("Connection")).toBeNull();
    expect(headers.get("Upgrade")).toBeNull();
    expect(headers.get("CF-Ray")).toBeNull();
  });

  it("preserves Upgrade and Connection when preserveUpgrade=true (websocket handshake)", () => {
    const url = new URL("https://cloudless.gr/ws");
    const req = makeRequest(url.toString(), {
      Connection: "upgrade",
      Upgrade: "websocket",
    });
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, true);

    expect(headers.get("Upgrade")).toBe("websocket");
    expect(headers.get("Connection")).toBe("upgrade");
  });

  it("forwards cf-connecting-ip as X-Forwarded-For and X-Real-IP", () => {
    const url = new URL("https://cloudless.gr/");
    const req = makeRequest(url.toString(), { "CF-Connecting-IP": "203.0.113.5" });
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, false);

    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.5");
    expect(headers.get("X-Real-IP")).toBe("203.0.113.5");
  });

  it("appends cf-connecting-ip to an existing X-Forwarded-For chain", () => {
    const url = new URL("https://cloudless.gr/");
    const req = makeRequest(url.toString(), {
      "CF-Connecting-IP": "203.0.113.5",
      "X-Forwarded-For": "198.51.100.9",
    });
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, false);

    expect(headers.get("X-Forwarded-For")).toBe("198.51.100.9, 203.0.113.5");
    expect(headers.get("X-Real-IP")).toBe("203.0.113.5");
  });

  it("does not add XFF/X-Real-IP when cf-connecting-ip is absent", () => {
    const url = new URL("https://cloudless.gr/");
    const req = makeRequest(url.toString());
    const headers = buildForwardHeaders(req, url, ORIGIN_HOST, false);

    expect(headers.get("X-Forwarded-For")).toBeNull();
    expect(headers.get("X-Real-IP")).toBeNull();
  });
});

describe("pi-origin-proxy: buildResponseHeaders", () => {
  it("strips hop-by-hop response headers", () => {
    const upstream = new Response(null, {
      status: 200,
      headers: {
        "content-type": "text/html",
        connection: "keep-alive",
        "transfer-encoding": "chunked",
        upgrade: "h2c",
      },
    });
    const out = buildResponseHeaders(upstream, new URL("https://cloudless.gr/"), ORIGIN_HOST);

    expect(out.get("content-type")).toBe("text/html");
    expect(out.get("connection")).toBeNull();
    expect(out.get("transfer-encoding")).toBeNull();
    expect(out.get("upgrade")).toBeNull();
  });

  it("rewrites same-host absolute Location on 3xx back to the proxy host", () => {
    const upstream = new Response(null, {
      status: 302,
      headers: { Location: `https://${ORIGIN_HOST}/dashboard?x=1` },
    });
    const out = buildResponseHeaders(upstream, new URL("https://cloudless.gr/login"), ORIGIN_HOST);

    expect(out.get("Location")).toBe("https://cloudless.gr/dashboard?x=1");
  });

  it("leaves off-host Location URLs untouched", () => {
    const upstream = new Response(null, {
      status: 301,
      headers: { Location: "https://example.com/other" },
    });
    const out = buildResponseHeaders(upstream, new URL("https://cloudless.gr/"), ORIGIN_HOST);

    expect(out.get("Location")).toBe("https://example.com/other");
  });

  it("does not rewrite Location on non-3xx responses", () => {
    const upstream = new Response(null, {
      status: 200,
      headers: { Location: `https://${ORIGIN_HOST}/somewhere` },
    });
    const out = buildResponseHeaders(upstream, new URL("https://cloudless.gr/"), ORIGIN_HOST);

    // 2xx with Location is unusual; leave the value alone regardless of host.
    expect(out.get("Location")).toBe(`https://${ORIGIN_HOST}/somewhere`);
  });

  it("resolves relative Location URLs against the origin host and rewrites them", () => {
    const upstream = new Response(null, {
      status: 307,
      headers: { Location: "/reset-password" },
    });
    const out = buildResponseHeaders(upstream, new URL("https://cloudless.gr/login"), ORIGIN_HOST);

    // Relative Location resolves against origin host → same-host → rewritten.
    expect(out.get("Location")).toBe("https://cloudless.gr/reset-password");
  });
});

describe("pi-origin-proxy: isCacheable (request-side)", () => {
  it("accepts GET on known static prefixes", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=%2Ffoo.png&w=640&q=75",
      "/icons/logo.svg",
      "/images/hero.webp",
    ]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(true);
    }
  });

  it("accepts GET on known static exact paths", () => {
    for (const path of ["/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(true);
    }
  });

  it("accepts GET on known static file extensions", () => {
    for (const path of [
      "/some.css",
      "/some.js",
      "/some.mjs",
      "/some.woff2",
      "/some.png",
      "/some.webp",
    ]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(true);
    }
  });

  it("rejects non-GET methods", () => {
    expect(isCacheable(makeRequest("https://cloudless.gr/_next/static/x.js", {}, "POST"))).toBe(
      false,
    );
    expect(isCacheable(makeRequest("https://cloudless.gr/_next/static/x.js", {}, "HEAD"))).toBe(
      false,
    );
  });

  it("rejects requests carrying Cookie or Authorization", () => {
    expect(
      isCacheable(
        makeRequest("https://cloudless.gr/_next/static/x.js", { Cookie: "session=abc" }),
      ),
    ).toBe(false);
    expect(
      isCacheable(
        makeRequest("https://cloudless.gr/_next/static/x.js", { Authorization: "Bearer t" }),
      ),
    ).toBe(false);
  });

  it("rejects dynamic paths that aren't static assets", () => {
    for (const path of ["/", "/en", "/en/services", "/api/auth/login", "/dashboard"]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(false);
    }
  });

  it("rejects service workers even though they have a .js extension", () => {
    // A 4h edge-cached /sw.js would silently freeze the PWA cache version
    // for users; the browser only refreshes SWs when it sees a byte diff.
    for (const path of ["/sw.js", "/service-worker.js"]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(false);
    }
  });

  it("rejects workbox-* runtime companions", () => {
    for (const path of ["/workbox-abc123.js", "/workbox-catch-handler.js"]) {
      expect(isCacheable(makeRequest(`https://cloudless.gr${path}`))).toBe(false);
    }
  });
});

describe("pi-origin-proxy: isResponseCacheable (response-side)", () => {
  const cacheableCC = "public, max-age=31536000, immutable";

  it("accepts 200 + explicit max-age", () => {
    const r = new Response(null, { status: 200, headers: { "cache-control": cacheableCC } });
    expect(isResponseCacheable(r)).toBe(true);
  });

  it("accepts 200 + explicit s-maxage", () => {
    const r = new Response(null, {
      status: 200,
      headers: { "cache-control": "public, s-maxage=600" },
    });
    expect(isResponseCacheable(r)).toBe(true);
  });

  it("rejects non-200 responses", () => {
    for (const status of [204, 301, 302, 404, 500]) {
      const r = new Response(null, { status, headers: { "cache-control": cacheableCC } });
      expect(isResponseCacheable(r)).toBe(false);
    }
  });

  it("rejects responses missing Cache-Control", () => {
    const r = new Response(null, { status: 200 });
    expect(isResponseCacheable(r)).toBe(false);
  });

  it("rejects responses whose Cache-Control opts out", () => {
    for (const cc of ["no-store", "no-cache", "private, max-age=60", "no-store, max-age=60"]) {
      const r = new Response(null, { status: 200, headers: { "cache-control": cc } });
      expect(isResponseCacheable(r)).toBe(false);
    }
  });

  it("rejects responses that carry Set-Cookie", () => {
    const r = new Response(null, {
      status: 200,
      headers: { "cache-control": cacheableCC, "set-cookie": "id=abc; Path=/" },
    });
    expect(isResponseCacheable(r)).toBe(false);
  });
});

describe("pi-origin-proxy: wantsMarkdown (Accept negotiation)", () => {
  it("accepts a bare text/markdown accept header", () => {
    expect(
      wantsMarkdown(makeRequest("https://cloudless.gr/", { Accept: "text/markdown" })),
    ).toBe(true);
  });

  it("accepts text/markdown mixed with other types", () => {
    expect(
      wantsMarkdown(
        makeRequest("https://cloudless.gr/", {
          Accept: "text/html, application/xhtml+xml, text/markdown;q=0.9",
        }),
      ),
    ).toBe(true);
  });

  it("honors an explicit q=0 opt-out", () => {
    expect(
      wantsMarkdown(makeRequest("https://cloudless.gr/", { Accept: "text/markdown;q=0" })),
    ).toBe(false);
  });

  it("rejects browser defaults and missing headers", () => {
    expect(wantsMarkdown(makeRequest("https://cloudless.gr/"))).toBe(false);
    expect(
      wantsMarkdown(
        makeRequest("https://cloudless.gr/", {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }),
      ),
    ).toBe(false);
  });

  it("never negotiates markdown for non-GET methods", () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      expect(
        wantsMarkdown(
          makeRequest("https://cloudless.gr/", { Accept: "text/markdown" }, method),
        ),
      ).toBe(false);
    }
  });
});

describe("pi-origin-proxy: isHtmlResponse", () => {
  it("accepts 200 + text/html", () => {
    const r = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    expect(isHtmlResponse(r)).toBe(true);
  });

  it("rejects non-HTML content types and non-200", () => {
    for (const ct of ["application/json", "text/plain", "image/png"]) {
      const r = new Response("x", { status: 200, headers: { "content-type": ct } });
      expect(isHtmlResponse(r)).toBe(false);
    }
    const r404 = new Response("<html></html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    });
    expect(isHtmlResponse(r404)).toBe(false);
  });
});

describe("pi-origin-proxy: toMarkdownResponse", () => {
  const htmlResponse = () =>
    new Response("<html><body><h1>Hello</h1><p>world</p></body></html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        etag: '"abc123"',
        "last-modified": "Mon, 01 Jan 2024 00:00:00 GMT",
        "cache-control": "public, max-age=60",
      },
    });

  const fakeAi = (format: string, data = "# Hello\n\nworld") => ({
    toMarkdown: async () =>
      format === "error"
        ? { id: "1", name: "index.html", mimeType: "text/html", format, error: "boom" }
        : { id: "1", name: "index.html", mimeType: "text/html", format, tokens: 128, data },
  });

  it("returns text/markdown with x-markdown-tokens and Vary: Accept", async () => {
    const res = await toMarkdownResponse(
      htmlResponse(),
      fakeAi("markdown") as unknown as Ai,
      new URL("https://cloudless.gr/"),
    );
    expect(res).not.toBeNull();
    expect(res!.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res!.headers.get("x-markdown-tokens")).toBe("128");
    expect(res!.headers.get("vary")?.toLowerCase()).toContain("accept");
    // HTML-descriptive headers must not survive the body swap.
    expect(res!.headers.get("etag")).toBeNull();
    expect(res!.headers.get("last-modified")).toBeNull();
    // Cache/response headers that still apply are preserved.
    expect(res!.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await res!.text()).toBe("# Hello\n\nworld");
  });

  it("returns null on converter error so the caller falls back to HTML", async () => {
    const upstream = htmlResponse();
    const res = await toMarkdownResponse(
      upstream,
      fakeAi("error") as unknown as Ai,
      new URL("https://cloudless.gr/"),
    );
    expect(res).toBeNull();
    // Regression: the upstream body must stay consumable for the HTML
    // fallback — toMarkdownResponse reads from a clone.
    expect(await upstream.text()).toContain("<h1>Hello</h1>");
  });

  it("returns null on empty upstream body", async () => {
    const empty = new Response("", { status: 200, headers: { "content-type": "text/html" } });
    const res = await toMarkdownResponse(
      empty,
      fakeAi("markdown") as unknown as Ai,
      new URL("https://cloudless.gr/"),
    );
    expect(res).toBeNull();
  });
});
