# auth.md — Agent Authentication for cloud.cloudless.gr

```json agent_auth
{
  "register_uri": "https://cloud.cloudless.gr/login",
  "token_uri": "https://cloud.cloudless.gr/ocs/v2.php/core/getapppassword",
  "identity_types_supported": ["identity_assertion"],
  "identity_assertion": {
    "assertion_types_supported": ["verified_email"],
    "credential_types_supported": ["app_password"]
  },
  "authorization_servers": ["https://cloud.cloudless.gr"],
  "protected_resource": "https://cloud.cloudless.gr/.well-known/oauth-protected-resource",
  "contact": "tbaltzakis@cloudless.gr"
}
```

Nextcloud OCS/WebDAV API: obtain an app password via
`/ocs/v2.php/core/getapppassword` (Basic auth) or interactively at
Settings → Security → App passwords. Send `Authorization: Basic` with
the app password; scope is per-account.
