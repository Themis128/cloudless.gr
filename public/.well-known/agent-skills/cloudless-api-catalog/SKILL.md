---
name: cloudless-api-catalog
description: Discover and call the public Cloudless.gr JSON APIs (docs index, chat, calendar, health) via the RFC 9727 linkset catalog.
---

# Cloudless API Catalog

Use this skill to find the right public Cloudless.gr API for a task.

## Steps

1. GET `https://cloudless.gr/.well-known/api-catalog`
   (`Content-Type: application/linkset+json`). Each `linkset` entry anchors a
   resource and maps `service-desc` / `service-doc` / `status` URLs.
2. Read the `service-desc` URL for the machine-readable description of the
   endpoint you need, then call the `anchor` URL directly.

## Endpoints you will find

- `GET /api/docs` — documentation index grouped by category (JSON).
- `POST /api/chat` — assistant chat; JSON body with the user message.
- `GET /api/calendar/availability?date=YYYY-MM-DD` — open consultation slots.
- `POST /api/calendar/book` — book a consultation slot.
- `GET /api/health` — liveness.

Pages on cloudless.gr also honor `Accept: text/markdown` — request Markdown
instead of HTML to save tokens.
