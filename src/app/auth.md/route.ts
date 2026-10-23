import { NextResponse } from "next/server";

export async function GET() {
  const content = `# auth.md — Agent Authentication & Registration (Cloudless.gr)

This document describes how agents and automated clients register and authenticate with the Cloudless.gr API.

## Authentication Method
Cloudless.gr uses session-based authentication (NextAuth credentials). An
authenticated session is established interactively at \`/auth/login\`; API
requests carry the session cookie or the session token in the
\`Authorization: Bearer\` header.

## Discovery
- OIDC discovery: \`/.well-known/openid-configuration\`
- OAuth 2.0 Protected Resource Metadata (RFC 9728): \`/.well-known/oauth-protected-resource\`
- Authorization Server Metadata (RFC 8414): \`/.well-known/oauth-authorization-server\`

## Registration
1. **Self-service**: \`POST /api/auth/register\` with \`{"email", "password"}\` creates an account and sends an activation email; the account is usable once the link in that email is confirmed.
2. **Service/agent accounts**: request a dedicated account via the administrative contact (\`/contact\`) — state the agent's identity and intended use.

## Authentication Flow
\`\`\`http
GET /auth/login            # interactive sign-in
GET /api/auth/session      # current session state (JSON)
\`\`\`

## Scopes
The following scopes are available:
- \`openid\`: Basic identity
- \`profile\`: User profile access
- \`email\`: Email address access
- \`admin\`: Administrative access to system settings
- \`analytics.read\`: Read-only access to analytics data
- \`calendar.write\`: Ability to book consultations

## Rate Limits
Agents are subject to rate limiting. Please respect the \`Retry-After\` headers in 429 responses.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
