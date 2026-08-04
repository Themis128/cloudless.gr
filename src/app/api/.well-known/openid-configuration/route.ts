import { NextResponse } from "next/server";

export async function GET() {
  const config = {
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
  };

  return NextResponse.json(config);
}
