# auth.md — Agent Authentication for cloud.cloudless.gr

```json agent_auth
{
  "register_uri": "https://cloud.cloudless.gr/apps/oauth2/clients",
  "authorization_endpoint": "https://cloud.cloudless.gr/apps/oauth2/authorize",
  "token_uri": "https://cloud.cloudless.gr/apps/oauth2/api/v1/token",
  "identity_types_supported": ["identity_assertion"],
  "identity_assertion": {
    "assertion_types_supported": ["verified_email"],
    "credential_types_supported": ["app_password", "oauth2_access_token"]
  },
  "authorization_servers": ["https://cloud.cloudless.gr"],
  "protected_resource": "https://cloud.cloudless.gr/.well-known/oauth-protected-resource",
  "contact": "tbaltzakis@cloudless.gr"
}
```

Two credential paths:

- **OAuth2 (preferred for agents):** register a client under Settings →
  Security → OAuth 2.0 (`/apps/oauth2/clients`), then the standard
  authorization-code flow via `/apps/oauth2/authorize` and
  `/apps/oauth2/api/v1/token`.
- **App password (simple scripts):** POST Basic-auth credentials to
  `/ocs/v2.php/core/getapppassword`, or create one interactively at
  Settings → Security → App passwords. Send `Authorization: Basic` or
  Bearer with the returned app password; scope is per-account.
