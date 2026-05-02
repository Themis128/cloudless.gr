# Google Calendar Integration

cloudless.gr integrates with Google Calendar to offer consultation booking. Users can browse available time slots and book 30-minute consultations that automatically create Google Calendar events with Google Meet links.

> **Status:** Optional integration — returns 503 when Google service account credentials are not configured. The rest of the app is unaffected.
>
> **Last verified:** 2026-05-01 — 8 unit tests pass (auth, DST-correct slot generation, booking success/error, consultations filter)

---

## Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        BookUI["Booking Widget"] -->|GET| AvailAPI["/api/calendar/availability"]
        BookUI -->|POST| BookAPI["/api/calendar/book"]
    end

    subgraph Auth["Service Account Auth (google-auth.ts)"]
        AvailAPI --> GetToken["getAccessToken()"]
        BookAPI --> GetToken
        GetToken -->|sign JWT with RS256| TokenURL["Google OAuth2"]
        TokenURL -->|access_token| GetToken
        GetToken -->|cached per scope until expiry| Cache["Closure cache"]
    end

    subgraph GCalAPI["Google Calendar API"]
        AvailAPI -->|freeBusy query| FreeBusy["POST /freeBusy"]
        BookAPI -->|create event| CreateEvt["POST /calendars/.../events"]
        CreateEvt -->|with conferenceData| Meet["Google Meet link"]
    end

    subgraph Notify["Post-Booking"]
        BookAPI -->|fire-and-forget| Slack["slackBookingNotify()"]
        BookAPI -->|fire-and-forget| HubSpot["upsertContact + createDeal"]
    end
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant Lib as google-calendar.ts
    participant Auth as createGoogleAuth() closure
    participant Jose as jose library
    participant Google as Google OAuth2

    Lib->>Auth: getAccessToken()
    alt Token valid and not expired
        Auth-->>Lib: Return cached token
    else Expired or missing
        Auth->>Auth: Read GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (via getConfig)
        Auth->>Jose: importPKCS8(privateKey, RS256)
        Auth->>Jose: new SignJWT({ iss, scope, aud })
        Jose-->>Auth: Signed JWT assertion
        Auth->>Google: POST token endpoint with jwt-bearer grant
        Google-->>Auth: { access_token, expires_in }
        Auth->>Auth: Cache token with expiry minus 60s buffer
        Auth-->>Lib: access_token
    end
```

> **Token caching:** The `createGoogleAuth()` factory in `src/lib/google-auth.ts` returns a closure that caches the token in memory. The cache is per-scope, so the Calendar scope and the GSC scope maintain independent tokens.

---

## Environment Variables

### Local development (`.env.local`)

```bash
GOOGLE_CLIENT_EMAIL=calendar-bot@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

### Production (AWS SSM Parameter Store)

| Parameter path | Type |
|----------------|------|
| `/cloudless/production/GOOGLE_CLIENT_EMAIL` | String |
| `/cloudless/production/GOOGLE_PRIVATE_KEY` | SecureString |
| `/cloudless/production/GOOGLE_CALENDAR_ID` | String |

---

## API Reference

### `GET /api/calendar/availability`

Returns available 30-minute consultation slots.

**Query params:**
- `days` (optional, default: 7, range: 1–30) — how many days ahead to check

**Response:** `{ slots: [{ start: ISO8601, end: ISO8601 }, ...] }`

**Caching:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` (5-minute CDN cache)

**Slot generation logic:**
- Business hours: 09:00–17:00 Europe/Athens (DST-aware — UTC+2 in winter EET, UTC+3 in summer EEST)
- Weekdays only (skip Saturday/Sunday)
- 30-minute intervals
- Excludes slots that overlap with existing calendar events (via freeBusy API)
- Excludes past slots

### `POST /api/calendar/book`

Books a consultation slot.

**Rate limiting:** 5 requests per IP per 10 minutes.

**Request body:**
```json
{ "name": "string", "email": "string", "start": "ISO8601", "end": "ISO8601", "notes": "optional string" }
```

**Validation:**
- Name, email, start, end are required
- Email must pass `isValidEmail()` check
- Start must be in the future
- End must be after start

**On success:**
- Creates a Google Calendar event with:
  - Summary: `Cloudless Consultation — {name}`
  - Attendee: user's email (gets calendar invite)
  - Google Meet link auto-generated
  - Reminders: email (60 min before) + popup (15 min before)
  - Timezone: Europe/Athens
- Fires `slackBookingNotify()` (fire-and-forget) with Block Kit blocks
- Creates HubSpot contact + deal + note (fire-and-forget)
- Returns `{ success: true, eventId, meetingLink }`

### `getConsultationsByEmail(email)`

Search consultation events for a specific attendee. Looks 90 days back and 30 days ahead. Returns array of `{ id, title, start, end, meetLink?, status: "upcoming" | "past" }`.

---

## Booking Flow

```mermaid
sequenceDiagram
    participant User as User Browser
    participant Avail as /api/calendar/availability
    participant Book as /api/calendar/book
    participant GCal as Google Calendar API
    participant Slack as slackBookingNotify
    participant HS as HubSpot
    User->>Avail: GET /api/calendar/availability?days=7
    Avail->>GCal: POST freeBusy query
    GCal-->>Avail: Busy time ranges
    Avail->>Avail: Generate 30-min slots (DST-correct Athens hours)
    Avail-->>User: { slots: [...] }

    User->>User: Select a slot
    User->>Book: POST { name, email, start, end, notes? }
    Book->>Book: Rate-limit check (5/IP/10min)
    Book->>Book: Validate fields + email + future date
    Book->>GCal: POST create event with conferenceData
    GCal-->>Book: { id, htmlLink }
    Book->>Slack: slackBookingNotify (fire-and-forget)
    Book->>HS: upsertContact + createDeal (fire-and-forget)
    Book-->>User: { success: true, eventId, meetingLink }
```

---

## Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > **IAM & Admin > Service Accounts**
2. Create a service account (e.g., `calendar-bot`)
3. Create a JSON key and extract `client_email` and `private_key`
4. Enable the **Google Calendar API** in your project
5. Share your calendar with the service account email (give "Make changes to events" permission)

---

## Running Tests

```bash
pnpm test -- --reporter=verbose __tests__/google-calendar.test.ts
pnpm test -- --reporter=verbose __tests__/calendar-api.test.ts
```

Test coverage (8 + 13 tests):

| File | Tests | What is tested |
|------|-------|---------------|
| `google-calendar.test.ts` | 8 | getAccessToken throws when unconfigured, freeBusy failure → empty array, DST-correct UTC slot times for summer and winter, bookConsultation error/success, getConsultationsByEmail filter |
| `calendar-api.test.ts` | 13 | 503 when unconfigured, slot shape, days cap (max 30, default 7), 400 validation (missing fields, bad email, past date), 200 success with eventId, Slack notification fired, 500 on booking failure |

---

## Security Notes

- **Service account key:** Store `GOOGLE_PRIVATE_KEY` as SecureString in SSM. Never commit to repo.
- **Shared auth module:** `src/lib/google-auth.ts` provides `createGoogleAuth(scope)` — one factory covers both Calendar and GSC with independent per-scope token caches.
- **Token caching:** Tokens cached with 60-second buffer before expiry to avoid race conditions.
- **DST handling:** Slot generation uses `Intl.DateTimeFormat.formatToParts()` to compute the correct Athens UTC offset per-day (UTC+2 in winter EET, UTC+3 in summer EEST).
- **Input validation:** Email validated, dates checked for future, all required fields enforced.
- **Rate limiting:** 5 booking attempts per IP per 10 minutes prevents calendar spam.
- **Graceful degradation:** Returns 503 if not configured — no crash, no partial state.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-auth.ts` | Shared OAuth2 service-account JWT factory (`createGoogleAuth`) used by both Calendar and GSC |
| `src/lib/google-calendar.ts` | freeBusy queries, event creation, consultation lookup, DST-aware slot generation |
| `src/app/api/calendar/availability/route.ts` | GET available slots (days 1–30, 5-min CDN cache) |
| `src/app/api/calendar/book/route.ts` | POST booking with validation, rate-limit, Slack + HubSpot fire-and-forget |
| `src/lib/slack-notify.ts` | `slackBookingNotify()` — Block Kit booking notification with mrkdwn-escaped fields |
