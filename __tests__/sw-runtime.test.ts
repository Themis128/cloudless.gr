import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchEvent = {
  request: Request | { method: string; mode: string; url: string };
  respondWith: (value: Promise<Response> | Response) => void;
  waitUntil: (value: Promise<unknown>) => void;
};

function createFetchEvent(request: FetchEvent["request"]) {
  let responsePromise: Promise<Response> | undefined;

  return {
    request,
    respondWith(value: Promise<Response> | Response) {
      responsePromise = Promise.resolve(value);
    },
    waitUntil: vi.fn(),
    getResponse() {
      return responsePromise;
    },
  };
}

function loadServiceWorker() {
  const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners = new Map<string, (event: unknown) => void>();

  const dynamicPut = vi.fn(async () => undefined);
  const staticPut = vi.fn(async () => undefined);
  const cacheMatch = vi.fn(async () => undefined as Response | undefined);
  const cacheKeys = vi.fn(async () => [] as Request[]);

  const cachesMock = {
    open: vi.fn(async (cacheName: string) => ({
      addAll: vi.fn(async () => undefined),
      add: vi.fn(async () => undefined),
      put: cacheName.includes("static") ? staticPut : dynamicPut,
      match: cacheMatch,
      keys: cacheKeys,
      delete: vi.fn(async () => true),
    })),
    keys: vi.fn(async () => [] as string[]),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => undefined as Response | undefined),
  };

  const fetchMock = vi.fn();

  const selfMock = {
    addEventListener: vi.fn((eventName: string, callback: (event: unknown) => void) => {
      listeners.set(eventName, callback);
    }),
    skipWaiting: vi.fn(),
    // The SW uses self.location.origin to filter cross-origin requests.
    // Match the origin used by all test URLs so same-origin requests aren't dropped.
    location: { origin: "http://localhost:4000" },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn(async () => []),
      openWindow: vi.fn(async () => undefined),
    },
    registration: {
      showNotification: vi.fn(async () => undefined),
    },
  };

  vm.runInNewContext(source, {
    self: selfMock,
    caches: cachesMock,
    fetch: fetchMock,
    URL,
    Request,
    Response,
    Promise,
    console,
  });

  return {
    listeners,
    fetchMock,
    cachesMock,
    selfMock,
    dynamicPut,
    staticPut,
    cacheMatch,
    cacheKeys,
  };
}

describe("service worker runtime", () => {
  it("ignores non-GET requests", () => {
    const { listeners } = loadServiceWorker();
    const handler = listeners.get("fetch");
    expect(handler).toBeTruthy();

    const event = createFetchEvent(
      new Request("http://localhost:4000/api/ping", { method: "POST" }),
    );
    handler?.(event as unknown as FetchEvent);

    expect(event.getResponse()).toBeUndefined();
  });

  it("ignores non-http(s) schemes", () => {
    const { listeners } = loadServiceWorker();
    const handler = listeners.get("fetch");
    expect(handler).toBeTruthy();

    const event = createFetchEvent({
      method: "GET",
      mode: "no-cors",
      url: "chrome-extension://example/script.js",
    });

    handler?.(event as unknown as FetchEvent);
    expect(event.getResponse()).toBeUndefined();
  });

  it("returns 503 for failed API fetches", async () => {
    const { listeners, fetchMock } = loadServiceWorker();
    const handler = listeners.get("fetch");
    expect(handler).toBeTruthy();

    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const event = createFetchEvent(new Request("http://localhost:4000/api/ping"));
    handler?.(event as unknown as FetchEvent);

    const response = await event.getResponse();
    expect(response).toBeTruthy();
    expect(response?.status).toBe(503);
    expect(await response?.text()).toContain("API unavailable offline");
  });

  it("serves cached static assets via stale-while-revalidate", async () => {
    const { listeners, fetchMock, cacheMatch } = loadServiceWorker();
    const handler = listeners.get("fetch");
    expect(handler).toBeTruthy();

    const cached = new Response("cached-image", { status: 200 });
    cacheMatch.mockResolvedValueOnce(cached);
    // SWR fires background revalidation — provide a network response so fetch doesn't throw
    fetchMock.mockResolvedValue(new Response("fresh-image", { status: 200 }));

    // Use .png (non-JS/CSS) to trigger stale-while-revalidate path (not network-first)
    const event = createFetchEvent(new Request("http://localhost:4000/icons/icon-192.png"));
    handler?.(event as unknown as FetchEvent);

    const response = await event.getResponse();
    // Cached version returned immediately
    expect(await response?.text()).toBe("cached-image");
    // Background revalidation fetch was fired
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches successful navigation responses in dynamic cache", async () => {
    const { listeners, fetchMock, dynamicPut } = loadServiceWorker();
    const handler = listeners.get("fetch");
    expect(handler).toBeTruthy();

    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const event = createFetchEvent({
      method: "GET",
      mode: "navigate",
      url: "http://localhost:4000/contact",
    });

    handler?.(event as unknown as FetchEvent);
    const response = await event.getResponse();

    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("ok");
    expect(dynamicPut).toHaveBeenCalledTimes(1);
  });

  it("uses default push payload when push data is missing", async () => {
    const { listeners, selfMock } = loadServiceWorker();
    const handler = listeners.get("push");
    expect(handler).toBeTruthy();

    let pending: Promise<unknown> | undefined;
    const event = {
      data: null,
      waitUntil(promise: Promise<unknown>) {
        pending = promise;
      },
    };

    handler?.(event);
    await pending;

    expect(selfMock.registration.showNotification).toHaveBeenCalledWith("Cloudless", {
      body: "New notification",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [100, 50, 100],
      data: undefined,
    });
  });
});
