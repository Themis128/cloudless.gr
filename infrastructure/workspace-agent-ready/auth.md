# auth.md — Agent Authentication for cloud.cloudless.gr

```json agent_auth
{
  "authorization_endpoint": "https://cloud.cloudless.gr/apps/oauth2/authorize",
  "token_uri": "https://cloud.cloudless.gr/apps/oauth2/api/v1/token",
  "register_uri": "https://cloud.cloudless.gr/ocs/v2.php/core/getapppassword",
  "dynamic_registration": false,
  "registration_contact": "tbaltzakis@cloudless.gr",
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

Two credential paths (no dynamic client registration — an administrator
provisions credentials):

- **OAuth2 (preferred for agents):** an admin registers the client under
  Settings → Security → OAuth 2.0, then the standard authorization-code
  flow via `/apps/oauth2/authorize` and `/apps/oauth2/api/v1/token`.
- **App password (simple scripts):** `GET /ocs/v2.php/core/getapppassword`
  with `OCS-APIRequest: true` and `Authorization: Basic <user>:<pass>`,
  or create one interactively at Settings → Security → App passwords.
  Send `Authorization: Basic` or Bearer with the returned app password;
  scope is per-account.
