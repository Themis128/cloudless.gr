import { NextResponse } from "next/server";

// RFC 8414 OAuth 2.0 Authorization Server Metadata for issuer
// https://cloudless.gr — same issuer the Protected Resource Metadata
// (/.well-known/oauth-protected-resource) advertises. Values mirror the OIDC
// discovery document; both describe the same endpoints.
export async function GET() {
  return NextResponse.json({
    issuer: "https://cloudless.gr",
    authorization_endpoint: "https://cloudless.gr/auth/login",
    token_endpoint: "https://cloudless.gr/api/auth/session",
    userinfo_endpoint: "https://cloudless.gr/api/user/profile",
    jwks_uri: "https://cloudless.gr/api/auth/jwks",
    response_types_supported: ["code", "token", "id_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email", "admin"],
    grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
  });
}
