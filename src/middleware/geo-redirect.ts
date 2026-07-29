/**
 * Lambda@Edge → Workers Middleware: Geo Redirect
 *
 * Replaces Lambda@Edge geo-routing with Workers cf object.
 * Workers has access to request.cf for geolocation at the edge.
 */
import { routing } from "@/i18n/routing";

const LOCALES = routing.locales as readonly string[];

function stripLocalePrefix(pathname: string): string {
  const segment = pathname.split("/")[1];
  if (LOCALES.includes(segment)) {
    return pathname.slice(segment.length + 1) || "/";
  }
  return pathname;
}

export interface GeoEnv {
  CF_SITE_URL?: string;
}

interface CfRequest extends Request {
  cf?: { country?: string };
}

/**
 * Geo redirect middleware - serves regional content or redirects
 * Strips existing locale prefix before prepending /el to prevent /en/en/... cascade
 */
export async function geoRedirectMiddleware(
  request: Request,
  _env: GeoEnv
): Promise<Response | null> {
  const country = (request as CfRequest).cf?.country;

  if (country === "GR") {
    const url = new URL(request.url);
    // Strip existing locale prefix to prevent /en/en/... cascade
    const barePath = stripLocalePrefix(url.pathname);
    if (!url.pathname.startsWith("/el")) {
      url.pathname = `/el${barePath}`;
      return Response.redirect(url.toString(), 301);
    }
  }

  return null; // Continue to next middleware
}

/**
 * Get locale from request, falling back to default
 */
export function getLocale(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname.split("/")[1];

  // Check if it's a locale prefix
  if (LOCALES.includes(path)) {
    return path;
  }

  // Check Accept-Language header
  const acceptLang = request.headers.get("accept-language") || "";

  if (acceptLang.toLowerCase().startsWith("el")) return "el";
  if (acceptLang.toLowerCase().startsWith("es")) return "es";
  if (acceptLang.toLowerCase().startsWith("de")) return "de";
  if (acceptLang.toLowerCase().startsWith("fr")) return "fr";
  if (acceptLang.toLowerCase().startsWith("tr")) return "tr";

  return "en"; // Default
}
