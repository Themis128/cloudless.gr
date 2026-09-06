import { NextResponse } from "next/server";

/**
 * Shared 501 for AppFlowy admin write stubs.
 * Static log only — never echo request fields (CodeQL js/log-injection).
 */
export function appflowyWriteNotImplemented(surface: string): NextResponse {
  console.warn(`[Admin AppFlowy ${surface}] write not implemented (stub)`);
  return NextResponse.json(
    { error: "Write operations not yet implemented for AppFlowy" },
    { status: 501 }
  );
}
