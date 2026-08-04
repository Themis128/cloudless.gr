import { NextResponse } from "next/server";

export async function GET() {
  const content = `# Agent Authentication & Registration - Cloudless.gr

This document provides instructions for AI agents to register and authenticate with the Cloudless.gr API.

## Authentication Method
Cloudless.gr uses OAuth 2.0 / OpenID Connect (OIDC) for agent authentication.

## Discovery
Agents can discover authentication endpoints via:
- OIDC Configuration: \`/.well-known/openid-configuration\`
- Protected Resource Metadata: \`/.well-known/oauth-protected-resource\`

## Registration Process
1. **Request Access**: Agents should request a client ID and secret via the administrative contact or the provided registration URI in the OIDC configuration.
2. **Identity Verification**: Agents must provide their identity metadata (e.g., developer info, purpose of access).
3. **Credential Issuance**: Upon approval, a \`client_id\` and \`client_secret\` will be issued.

## Authentication Flow
Agents should use the \`client_credentials\` grant type for machine-to-machine communication:

\`\`\`http
POST /api/auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET
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
