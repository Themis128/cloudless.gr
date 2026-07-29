/**
 * Lambda@Edge → Workers Middleware: A/B Testing
 *
 * Replaces edge-based experiment routing with Workers middleware pattern.
 * Workers runs at the edge by default, making Lambda@Edge unnecessary.
 */
export const AB_EXPERIMENTS = {
  b: {
    weight: 0.5,
    variants: { a: "/", b: "/?variant=b" },
  },
} as const;

export interface AbContext {
  url: URL;
  experiment?: keyof typeof AB_EXPERIMENTS;
}

/**
 * A/B testing middleware - runs before main request handler
 */
export async function abTestingMiddleware(
  request: Request,
  _env: Record<string, unknown>,
  _context?: AbContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const experiment = url.searchParams.get("exp") as keyof typeof AB_EXPERIMENTS | null;

  if (experiment && AB_EXPERIMENTS[experiment]) {
    const variant = Math.random() < 0.5 ? "b" : "a";
    url.searchParams.set("variant", variant);
    return Response.redirect(url.toString(), 302);
  }

  return null; // Continue to next middleware
}

/**
 * Check if a request is part of an experiment
 */
export function getExperimentVariant(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("variant");
}
