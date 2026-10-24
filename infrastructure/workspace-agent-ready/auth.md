# auth.md — Agent Authentication for cloud.cloudless.gr

```json agent_auth
{
  "authorization_endpoint": "https://cloud.cloudless.gr/apps/oauth2/authorize",
  "token_uri": "https://cloud.cloudless.gr/apps/oauth2/api/v1/token",
  "register_uri": "https://cloud.cloudless.gr/ocs/v2.php/core/getapppassword",
  "dynamic_registration": false,
  "registration_contact": "tbaltzakis@cloudless.gr",
  "claim_uri": "https://cloud.cloudless.gr/auth.md",
  "identity_types_supported": ["identity_assertion"],
  "identity_assertion": {
    "assertion_types_supported": ["verified_email"],
    "claim_uri": "https://cloud.cloudless.gr/ocs/v2.php/core/getapppassword",
    "credential_types_supported": ["app_password", "oauth2_access_token"]
  },
  "authorization_servers": ["https://cloud.cloudless.gr"],
  "protected_resource": "https://cloud.cloudless.gr/.well-known/oauth-protected-resource",
  "contact": "tbaltzakis@cloudless.gr"
}
```

## Agent registration flow

1. **Identify** — send your registration request to
   `tbaltzakis@cloudless.gr` (or ask an existing admin account), including
   the app name and requested scopes.
2. **Provision** — the admin registers the OAuth client under
   Settings → Security → OAuth 2.0, or issues an app password at
   Settings → Security → App passwords.
3. **Claim credentials** — with an authenticated session,
   `GET /ocs/v2.php/core/getapppassword` (`OCS-APIRequest: true`) returns
   an app password; OAuth clients receive `client_id`/`client_secret`
   out-of-band from the admin.
4. **Authenticate** — OAuth2 authorization-code flow via
   `/apps/oauth2/authorize` + `/apps/oauth2/api/v1/token`, or
   `Authorization: Basic`/`Bearer` with the app password.

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
