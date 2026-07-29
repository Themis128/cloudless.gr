---
name: chat-booking
description: Cloudless chat widget booking tools — Google Calendar availability, slot booking, and book_slot tool. Use when the user asks about the booking flow, calendar integration, why check_calendar_availability returns "not configured", or how book_slot works. Triggers on "booking", "calendar", "book_slot", "check_calendar_availability", "consultation", "Google Calendar", "Meet link".
allowed-tools: mcp__cloudless-infra__cluster_run_command, mcp__cloudless-infra__aws_get_ssm_parameters, mcp__cloudless-infra__k3s_get_pod_logs
---

# Chat Booking — Cloudless Assistant

## Overview

The Cloudless chat widget exposes three tools to Bedrock:

1. `lookup_product` — Stripe / static catalog search
2. `check_calendar_availability` — free/busy query, returns open 30-min slots
3. `book_slot` — confirms a booking, creates Google Calendar event + Meet link

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/chat-tools.ts` | Tool schemas (`CHAT_TOOLS`) + `runTool()` dispatcher |
| `src/lib/google-calendar.ts` | `getAvailableSlots()`, `bookConsultation()` |
| `src/lib/google-auth.ts` | Google service-account JWT auth (reads creds from SSM via `getConfig()`) |
| `src/lib/integrations.ts` | `isConfiguredAsync()` — SSM-backed credential check |
| `src/app/api/chat/route.ts` | SYSTEM_PROMPT, `runBedrockChatLoop()` call |

## Booking Flow (in-chat)

```
1. Visitor asks to book
2. Bot calls check_calendar_availability(days_ahead?)
3. Tool returns up to 5 slots with ISO start/end + Athens-formatted label
4. Bot asks visitor to pick a slot and share name + email
5. Bot calls book_slot(name, email, start, end, notes?)
6. Tool calls bookConsultation() → creates GCal event + Google Meet
7. Bot confirms with Meet link; calendar invite sent to visitor's email
```

## Calendar Configuration

All three Google SSM params are set under `/cloudless/production/`:

- `GOOGLE_CLIENT_EMAIL` — service account email
- `GOOGLE_PRIVATE_KEY` — RSA private key (PEM, `\n` escaped)
- `GOOGLE_CALENDAR_ID` — `baltzakis.themis@gmail.com`

**Critical:** `chat-tools.ts` uses `isConfiguredAsync()` (NOT `isConfigured()`).  
`isConfigured()` is sync/env-only and always returns false in production (creds are SSM-only).  
`isConfiguredAsync()` does the SSM fallback — this is what makes calendar work at runtime.

## book_slot Tool Schema

```typescript
{
  name: string;          // visitor full name
  email: string;         // visitor email (receives calendar invite)
  start: string;         // ISO 8601, exactly from check_calendar_availability
  end: string;           // ISO 8601, exactly from check_calendar_availability
  notes?: string;        // optional context from visitor
}
```

Returns on success:

```
Booking confirmed!
Slot: Mon, 12 May, 10:00–10:30 Athens
Name: John Smith
Email: john@example.com
Google Meet: https://meet.google.com/xxx-xxxx-xxx
A calendar invite has been sent to john@example.com.
```

Returns on failure: human-readable error + suggestion to try another slot or use Contact page.

## Slot Format from check_calendar_availability

Each slot line includes both the human label and the raw ISO times for book_slot:

```
- Mon, 12 May, 10:00–10:30 Athens [start=2026-05-12T07:00:00.000Z end=2026-05-12T07:30:00.000Z]
```

The system prompt instructs the model to use start/end values **exactly** as returned — never invented.

## Business Hours

- Weekdays only (Mon–Fri)
- 09:00–17:00 Europe/Athens (DST-aware, UTC+2 EET / UTC+3 EEST)
- 30-minute slots
- Conflict detection via Google Calendar free/busy API

## Debugging

### Calendar returns "not yet wired up"

```
# Check isConfiguredAsync is used (not isConfigured) in chat-tools.ts:
grep "isConfigured" src/lib/chat-tools.ts
# Must show: isConfiguredAsync  (NOT plain isConfigured)
```

### Calendar API auth failing

```bash
# Check SSM params exist:
aws_get_ssm_parameters  # look for GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID

# Check pod logs for [chat-tools] errors:
kubectl logs -n cloudless deployment/cloudless --tail=50 | grep '\[chat'
```

### book_slot returns "slot no longer available"

- `bookConsultation()` returned null — usually means another booking claimed the slot between check and confirm
- Ask visitor to call `check_calendar_availability` again

## bookConsultation() — what it creates

- Google Calendar event titled `Cloudless Consultation — {name}`
- Attendee added: visitor email (receives invite)
- Google Meet link generated via `conferenceData`
- Email reminder: 60 min before
- Popup reminder: 15 min before
- Calendar: `GOOGLE_CALENDAR_ID` from SSM (default: `primary`)
