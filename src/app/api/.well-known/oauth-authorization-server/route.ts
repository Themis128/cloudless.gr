import { NextResponse } from "next/server";

// RFC 8414 Authorization Server Metadata for issuer https://cloudless.gr — the
// issuer the Protected Resource Metadata advertises. Only endpoints that
// actually exist are listed: the site runs session auth (NextAuth) with an
// interactive login surface; there is no public token endpoint or JWKS, so
// none is advertised.
export async function GET() {
  return NextResponse.json({
    issuer: "https://cloudless.gr",
    authorization_endpoint: "https://cloudless.gr/auth/login",
    scopes_supported: ["openid", "profile", "email", "admin"],
    service_documentation: "https://cloudless.gr/auth.md",
  });
}
