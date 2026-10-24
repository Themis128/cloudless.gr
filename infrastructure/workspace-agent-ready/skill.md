---
name: cloudless-workspace-ops
description: Operate the Cloudless Nextcloud workspace — files via WebDAV, shares and users via OCS REST API.
---

# Cloudless Workspace Ops

## Endpoints

- Status: `GET /status.php` — JSON `{installed, maintenance, version, edition}`
- OCS API: `GET /ocs/v2.php/...` with `OCS-APIRequest: true` header
- WebDAV files: `PROPFIND/GET/PUT /remote.php/dav/files/<user>/...`
- Calendars/contacts: `/remote.php/dav/calendars/`, `/remote.php/dav/addressbooks/`

## Auth

OAuth2 authorization-code (`/apps/oauth2/authorize` → `/apps/oauth2/api/v1/token`)
or app-password Basic auth (`/ocs/v2.php/core/getapppassword`). See /auth.md.

## Guardrails

Read-only by default for discovery. Mutating DAV/OCS calls require an
authenticated app password scoped to the service account.
