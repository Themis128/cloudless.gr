import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;
  return safeEqual(header.slice(BEARER_PREFIX.length), expected);
}

export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
