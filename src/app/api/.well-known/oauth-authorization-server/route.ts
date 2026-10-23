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
    // RFC 8414 required field — the interactive login issues session tokens
    // in a code-like flow; no token endpoint is advertised (none exists).
    response_types_supported: ["code"],
    scopes_supported: ["openid", "profile", "email", "admin"],
    service_documentation: "https://cloudless.gr/auth.md",
    // auth.md (WorkOS agent-auth profile) bootstrap surface — maps to the real
    // register/activate endpoints: POST register sends an activation email;
    // the claim happens at the emailed /api/auth/activate link.
    agent_auth: {
      skill: "https://cloudless.gr/auth.md",
      register_uri: "https://cloudless.gr/api/auth/register",
      claim_uri: "https://cloudless.gr/api/auth/activate",
      identity_types_supported: ["identity_assertion"],
      identity_assertion: {
        assertion_types_supported: ["verified_email"],
        credential_types_supported: ["email_password"],
      },
    },
  });
}
