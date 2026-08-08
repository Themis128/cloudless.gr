import { describe, expect, it } from "vitest";
import {
  buildForwardHeaders,
  buildResponseHeaders,
  isWebSocketUpgrade,
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
