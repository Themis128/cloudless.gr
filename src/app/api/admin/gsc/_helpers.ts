import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Shared helpers for GSC admin API routes to reduce duplication.
 * Each route handler follows the same pattern: auth check → action → error wrap.
 */

type AdminAuthResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * Guard an admin route handler. Returns the auth result — if `ok` is false,
 * the caller should immediately return `result.response`.
 */
export async function guardAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  return { ok: true };
}

/**
 * Parse a JSON body from the request. Returns `{ data }` on success
 * or `{ error }` with a 400 NextResponse on failure.
 */
export async function parseJsonBody<T>(
  request: NextRequest
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

/**
 * Wrap an async GSC operation with consistent error handling.
 * On success returns the JSON response; on failure logs and returns 502.
 */
export async function runGscOperation<T>(
  label: string,
  operation: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await operation();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[GSC ${label}] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
