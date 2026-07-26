import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * CSP violation report endpoint.
 *
 * Browsers POST a JSON body here whenever a directive in the
 * Content-Security-Policy(-Report-Only) header is violated. We log a
 * concise structured line to stdout — Sentry's tunnel/console capture
 * picks it up and groups by directive + blocked-uri so we can see
 * which resources are tripping CSP and decide whether to allow or
 * block them before promoting Report-Only → enforce.
 *
 * Two payload shapes are supported:
 *  - Legacy: `application/csp-report` with body `{ "csp-report": {...} }`
 *  - Modern: `application/reports+json` with body `[{ type: "csp-violation", body: {...} }, …]`
 */

interface CspReportLegacy {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "script-sample"?: string;
    "status-code"?: number;
    referrer?: string;
    disposition?: "enforce" | "report";
  };
}

interface CspReportModernEntry {
  type: string;
  url?: string;
  body?: {
    documentURL?: string;
    blockedURL?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    sample?: string;
    disposition?: "enforce" | "report";
  };
}

/** Strip newlines and control characters to prevent log injection. */
function sanitizeLogField(value: string | undefined): string {
  if (!value) return "?";
  // Replace newlines, carriage returns, and other control characters
  return value.replace(/[\r\n\x00-\x1f\x7f]/g, "_").slice(0, 500);
}

function logViolation(
  directive: string | undefined,
  blocked: string | undefined,
  source: string | undefined,
  doc: string | undefined,
  disposition: string | undefined
): void {
  // Single-line structured log so Sentry/CloudWatch can group cleanly.
  // Fields are sanitized to prevent log injection from browser-supplied values.
  // codeql[js/log-injection] -- all fields pass through sanitizeLogField() above
  // codeql[js/tainted-format-string] -- fields sanitized; template literal used for structured output only
  console.warn(
    `[csp-violation] dir=${sanitizeLogField(directive)} blocked=${sanitizeLogField(blocked)} ` +
      `source=${sanitizeLogField(source)} doc=${sanitizeLogField(doc)} disp=${sanitizeLogField(disposition)}`
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  // Both content types end up as JSON; just parse and dispatch by shape.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  if (Array.isArray(payload)) {
    // Modern Reporting-API payload
    for (const entry of payload as CspReportModernEntry[]) {
      if (entry?.type !== "csp-violation") continue;
      const b = entry.body ?? {};
      logViolation(b.effectiveDirective, b.blockedURL, b.sourceFile, b.documentURL, b.disposition);
    }
  } else if (payload && typeof payload === "object" && "csp-report" in payload) {
    // Legacy report-uri payload
    const r = (payload as CspReportLegacy)["csp-report"] ?? {};
    logViolation(
      r["effective-directive"] ?? r["violated-directive"],
      r["blocked-uri"],
      r["source-file"],
      r["document-uri"],
      r.disposition
    );
  }

  return new Response(null, { status: 204 });
}
