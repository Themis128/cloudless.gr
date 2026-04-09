# Google Calendar Integration

cloudless.gr integrates with Google Calendar to offer consultation booking. Users can browse available time slots and book 30-minute consultations that automatically create Google Calendar events with Google Meet links.

> **Status:** Optional integration — returns 503 when Google service account credentials are not configured. The rest of the app is unaffected.

---

## Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        BookUI["Booking Widget"] -->|GET| AvailAPI["/api/calendar/availability"]
        BookUI -->|POST| BookAPI["/api/calendar/book"]
    end

    subgraph Auth["Service Account Auth"]
        AvailAPI --> GetToken["getAccessToken()"]
        BookAPI --> GetToken
        GetToken -->|sign JWT with RS256| TokenURL["Google OAuth2"]
        TokenURL -->|access_token| GetToken
        GetToken -->|cached until expiry| Cache["Module-level cache"]
    end
    subgraph GCalAPI["Google Calendar API"]
        AvailAPI -->|freeBusy query| FreeBusy["GET free/busy"]
        BookAPI -->|create event| CreateEvt["POST events"]
        CreateEvt -->|with conferenceData| Meet["Google Meet link"]
    end

    subgraph Notify["Post-Booking"]
        BookAPI -->|fire-and-forget| Slack["slackNotify()"]
    end
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant Lib as google-calendar.ts
    participant Cache as Module Cache
    participant Jose as jose library
    participant Google as Google OAuth2

    Lib->>Cache: Check cached token
    alt Token valid and not expired
        Cache-->>Lib: Return cached token
    else Expired or missing
        Lib->>Lib: Read GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
        Lib->>Jose: importPKCS8(privateKey, RS256)
        Lib->>Jose: new SignJWT({ iss, scope, aud })
        Jose-->>Lib: Signed JWT assertion
        Lib->>Google: POST token endpoint with jwt-bearer grant
        Google-->>Lib: { access_token, expires_in }
        Lib->>Cache: Store token with expiry minus 60s buffer
    end
```

> **Why service account?** Server-to-server auth with no user consent required. The service account must have domain-wide delegation or direct calendar sharing.

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
- `days` (optional, default: 7, max: 30) — how many days ahead to check

**Response:** `{ slots: [{ start: ISO8601, end: ISO8601 }, ...] }`

**Caching:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` (5-minute cache)

**Slot generation logic:**
- Business hours: 09:00–17:00 Athens time (UTC+3)
- Weekdays only (skip Saturday/Sunday)
- 30-minute intervals
- Excludes slots that overlap with existing calendar events (via freeBusy API)
- Excludes past slots
### `POST /api/calendar/book`

Books a consultation slot.

**Request body:**
```json
{ "name": "string", "email": "string", "start": "ISO8601", "end": "ISO8601", "notes": "optional string" }
```

**Validation:**
- Name, email, start, end are required
- Email must pass `isValidEmail()` check
- Start must be in the future

**On success:**
- Creates a Google Calendar event with:
  - Summary: `Cloudless Consultation — {name}`
  - Attendee: user's email (gets calendar invite)
  - Google Meet link auto-generated
  - Reminders: email (60 min before) + popup (15 min before)
  - Timezone: Europe/Athens
- Sends Slack notification (fire-and-forget)
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
    participant Slack as slackNotify
    User->>Avail: GET /api/calendar/availability?days=7
    Avail->>GCal: POST freeBusy query
    GCal-->>Avail: Busy time ranges
    Avail->>Avail: Generate 30-min slots excluding busy times
    Avail-->>User: { slots: [...] }

    User->>User: Select a slot
    User->>Book: POST { name, email, start, end, notes? }
    Book->>Book: Validate fields + email + future date
    Book->>GCal: POST create event with conferenceData
    GCal-->>Book: { id, htmlLink }
    Book->>Slack: slackNotify booking details (fire-and-forget)
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

## Security Notes

- **Service account key:** Store `GOOGLE_PRIVATE_KEY` as SecureString in SSM. Never commit to repo.
- **Token caching:** Access tokens cached with 60-second buffer before expiry to avoid race conditions
- **Input validation:** Email validated, dates checked for future, all required fields enforced
- **Graceful degradation:** Returns 503 if not configured — no crash, no partial state

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-calendar.ts` | Service account auth, freeBusy queries, event creation, consultation lookup |
| `src/app/api/calendar/availability/route.ts` | GET available slots with caching |
| `src/app/api/calendar/book/route.ts` | POST booking with validation + Slack notification |
| `src/lib/integrations.ts` | `isConfigured()` check for Google credentials |
