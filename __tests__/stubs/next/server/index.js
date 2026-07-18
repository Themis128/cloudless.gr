/**
 * Stub for next/server used in Vitest.
 * Replaces the real Next.js server exports with test-compatible implementations.
 *
 * Updated for new architecture (no AWS services):
 * - NextRequest includes nextUrl property for proxy.ts
 * - NextRequest properly handles body from init
 * - NextResponse is both a namespace object AND callable as a constructor
 */

// NextRequest stub - includes all properties needed by proxy.ts and route handlers
export class NextRequest {
  constructor(url, init) {
    this.url = url.toString();
    // Store nextUrl with clone method for proxy.ts HTTPS enforcement
    const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
    // Add clone method to the URL object (available in Node.js 18+ but ensure it exists)
    urlObj.clone = () => new URL(urlObj.toString());
    this.nextUrl = urlObj;

    this.method = init?.method || "GET";
    this.headers = new Map();
    // Store body from init for text() method
    this.body = init?.body || "";

    // Set headers from init
    if (init?.headers) {
      const headerEntries =
        init.headers instanceof Headers
          ? init.headers
          : Object.entries(init.headers);
      for (const [key, value] of headerEntries) {
        this.headers.set(key.toLowerCase(), value);
      }
    }

    // Parse cookies from header
    this.cookies = new Map();
    const cookieHeader = this.headers.get("cookie");
    if (cookieHeader) {
      for (const part of cookieHeader.split(";")) {
        const [name, ...rest] = part.trim().split("=");
        const value = rest.join("=") || "";
        this.cookies.set(name, { value, name });
      }
    }
  }

  // Required for Stripe webhook route tests - returns stored body
  async text() {
    return this.body || "";
  }

  // Required for JSON body parsing
  async json() {
    const body = await this.text();
    return body ? JSON.parse(body) : {};
  }
}

// NextResponse as namespace with static methods
// Next.js NextResponse.redirect defaults to 307 (temporary redirect)
const nextResponseStatic = {
  json(data, init) {
    return {
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(String(data)),
      status: init?.status || 200,
      headers: new Headers(init?.headers),
    };
  },
  redirect(url, status = 307) {
    return {
      url: typeof url === "string" ? url : url.toString(),
      status,
      headers: new Headers({ location: typeof url === "string" ? url : url.toString() }),
    };
  },
  next() {
    return new Response(null, { status: 200 });
  },
};

// NextResponse as constructor for route handlers that use `new NextResponse()`
export const NextResponse = function NextResponse(body, init) {
  if (typeof body === "object" && body !== null && body.constructor === Object) {
    // Called as namespace: NextResponse.json(data, init)
    return nextResponseStatic.json(body, init);
  }
  // Called as constructor: new NextResponse(body, init)
  this.status = init?.status || 200;
  this.headers = new Headers(init?.headers);
  if (body) {
    this.text = () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body));
  } else {
    this.text = () => Promise.resolve("");
  }
};

// Copy static methods to the constructor function
Object.assign(NextResponse, nextResponseStatic);

export function userAgent() {
  return { isBot: () => false };
}

// Named export for direct instantiation
export default NextResponse;