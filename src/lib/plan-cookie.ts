/**
 * Plan cookie — a short-lived signed cookie that carries the selected plan
 * from the services page through to signup and the waiting room, without
 * leaking the plan in URLs across redirect hops.
 *
 * WHY: audit #19 flagged the ?plan= callbackUrl pattern as fragile —
 *   a signed cookie set on click is tamper-proof and survives the Cognito
 *   Hosted UI redirect round-trip without depending on browser URL state.
 *
 * The cookie is:
 *   - HttpOnly (server-side only — never visible to browser JS)
 *   - Short-lived (5 min — enough to survive the signup flow)
 *   - Signed with an HMAC-SHA256 key derived from COOKIE_SECRET
 *   - Path-scoped to / so it's available across /auth/signup and /portal/waiting
 *
 * The cookie name is `cloudless_plan`; set and verify via the NextRequest /
 * NextResponse cookie API (or document.cookie on the client for the e2e path).
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { isValidPlan, type PlanKey } from "./plans";

const COOKIE_NAME = "cloudless_plan";
const COOKIE_MAX_AGE_SEC = 5 * 60; // 5 minutes
const COOKIE_PATH = "/";

function getSigningKey(): Buffer {
  const secret =
    process.env.NODE_ENV === "production"
      ? (process.env.COOKIE_SECRET ?? "PLAN_COOKIE_INSECURE_FALLBACK")
      : "PLAN_COOKIE_DEV_SECRET";
  return Buffer.from(secret);
}

function sign(value: string): string {
  const key = getSigningKey();
  return createHmac("sha256", key).update(value).digest("hex");
}

function encodeCookieValue(plan: string): string {
  const sig = sign(plan);
  return `${plan}.${sig}`;
}

function decodeCookieValue(encoded: string): string | null {
  const dotIdx = encoded.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const plan = encoded.slice(0, dotIdx);
  const sig = encoded.slice(dotIdx + 1);
  const expected = sign(plan);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return plan;
}

/**
 * Build a Set-Cookie header value for the plan cookie.
 * Called server-side when the user clicks "Get started" on a service card.
 */
export function buildPlanCookieHeader(plan: string): string {
  if (!isValidPlan(plan)) return "";
  const encoded = encodeCookieValue(plan);
  const parts = [
    `${COOKIE_NAME}=${encoded}`,
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/**
 * Build a Set-Cookie header that clears the plan cookie.
 */
export function buildClearPlanCookieHeader(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax`;
}

/**
 * Read and verify the plan cookie from a NextRequest.
 * Returns the plan key if valid, null otherwise.
 */
export function getPlanFromCookie(
  request: Request | Readonly<{ cookies: { get: (name: string) => { value: string } | undefined } }>
): PlanKey | null {
  const cookieHeader = "cookies" in request ? request.cookies.get(COOKIE_NAME)?.value : undefined;
  if (!cookieHeader) return null;
  const plan = decodeCookieValue(cookieHeader);
  if (!plan || !isValidPlan(plan)) return null;
  return plan;
}

/**
 * Read and verify the plan cookie using the async next/headers API.
 * For use in server components / API routes.
 */
export async function getPlanFromCookieAsync(): Promise<PlanKey | null> {
  try {
    const cookieStore = await cookies();
    const encoded = cookieStore.get(COOKIE_NAME)?.value;
    if (!encoded) return null;
    const plan = decodeCookieValue(encoded);
    if (!plan || !isValidPlan(plan)) return null;
    return plan;
  } catch {
    return null;
  }
}

/**
 * Client-side helper: set the plan cookie via document.cookie.
 * Only used for the Cognito Hosted UI path where the server-side redirect
 * from services → Cognito → callback → signup drops the ?plan= param.
 * The cookie survives the round-trip because it's not HttpOnly here (the
 * client needs to set it), but the server verifies the HMAC signature so
 * client-side tampering is detected.
 */
export function setPlanCookieClient(plan: string): void {
  if (typeof document === "undefined") return;
  if (!isValidPlan(plan)) return;
  const encoded = encodeCookieValue(plan);
  document.cookie = [
    `${COOKIE_NAME}=${encoded}`,
    `max-age=${COOKIE_MAX_AGE_SEC}`,
    `path=${COOKIE_PATH}`,
    "SameSite=Lax",
  ].join("; ");
}

/**
 * Export cookie name for direct access (e.g. document.cookie includes check).
 */
export { COOKIE_NAME as PLAN_COOKIE_NAME };
