/**
 * Next.js instrumentation — runs once per server instance and must finish
 * before the process accepts requests (Next 16 gates the request handler on
 * `register()`).
 *
 * Next compiles this file for BOTH Node and Edge (Turbopack always builds
 * `instrumentation.edge`; see vercel/next.js#86479). Node-only APIs in THIS
 * file — even inside helpers — are reported as Edge errors (#85938). The
 * documented split is an inline NEXT_RUNTIME check + dynamic import of a
 * separate file (#61728: do not wrap the check in a helper).
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * @see https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

export { shouldBindRemoteAuthDb } from "./instrumentation-flags";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation.node");
    await registerNode();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    if (process.env.NODE_ENV === "development") return;
    await import("../sentry.edge.config");
  }
}
