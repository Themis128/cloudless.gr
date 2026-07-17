/**
 * Stub for next/server used in Vitest.
 * next-auth beta imports this via ESM bare specifier.
 */
export class NextRequest {
  constructor(url, init) {
    this.url = url;
    this.method = init?.method || "GET";
    this.headers = new Map(Object.entries(init?.headers || {}));
  }
}

export const NextResponse = {
  json: (data, init) => ({ json: () => Promise.resolve(data), ...init }),
  redirect: (url) => ({ url, status: 302 }),
};

export function userAgent() {
  return { isBot: () => false };
}
