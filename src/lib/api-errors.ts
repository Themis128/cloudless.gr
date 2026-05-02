import { NextResponse } from "next/server";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

/**
 * Map an error caught in a route handler to a JSON response when it is
 * something the route should surface specifically rather than a generic 500.
 *
 * Returns a NextResponse for known cases (currently
 * IntegrationNotConfiguredError -> 503), otherwise null so the caller can
 * fall through to its own handling.
 */
export function mapIntegrationError(err: unknown): NextResponse | null {
  if (err instanceof IntegrationNotConfiguredError) {
    return NextResponse.json(
      {
        error: "Service unavailable",
        reason: "integration_not_configured",
        missing: err.keys,
      },
      { status: 503 },
    );
  }
  return null;
}
