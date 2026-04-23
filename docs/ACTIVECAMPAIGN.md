# ActiveCampaign Email Marketing Integration

Cloudless uses ActiveCampaign for email campaign management, contact lists, and marketing automations. The integration lives in `src/lib/activecampaign.ts` and is exposed to the admin panel via REST API routes under `/api/admin/email/`.

> **Status:** Optional — all routes return `503 ActiveCampaign not configured.` when SSM keys are missing. The rest of the site is unaffected.

---

## Architecture

```
Admin Browser
    │
    └── fetchWithAuth() ── Cognito JWT ──► /api/admin/email/**
                                                │
                                        src/lib/activecampaign.ts
                                                │
                                        ActiveCampaign API v3
                                        https://{account}.api-us1.com/api/3/
```

All requests use the `Api-Token` header for authentication. The base URL is read from `ACTIVECAMPAIGN_API_URL` — this is your account-specific endpoint (e.g. `https://myaccount.api-us1.com`).

---

## Environment Variables

### Local development (`.env.local`)

```bash
ACTIVECAMPAIGN_API_URL=https://myaccount.api-us1.com
ACTIVECAMPAIGN_API_TOKEN=your-api-token-here
```

### Production (AWS SSM Parameter Store)

| Parameter path | Type |
|---|---|
| `/cloudless/production/ACTIVECAMPAIGN_API_URL` | String |
| `/cloudless/production/ACTIVECAMPAIGN_API_TOKEN` | SecureString |

Both values are found in your ActiveCampaign account under **Settings → Developer → API Access**.

---

## API Reference (`src/lib/activecampaign.ts`)

### `isActiveCampaignConfigured(): Promise<boolean>`

Returns `true` if both `ACTIVECAMPAIGN_API_URL` and `ACTIVECAMPAIGN_API_TOKEN` are set.

---

### `listCampaigns(limit?): Promise<ACCampaign[]>`

Fetch recent email campaigns sorted by send date descending.

**Default limit:** 20 (max 100)

```typescript
const campaigns = await listCampaigns(50);
```

**`ACCampaign` shape:**

| Field | Type | Description |
|---|---|---|
| `id` | string | Campaign ID |
| `name` | string | Campaign name |
| `subject` | string | Email subject line |
| `status` | string | `0` = draft, `1` = scheduled/sent |
| `send_amt` | string | Total sends |
| `opens` | string | Total opens |
| `uniqueopens` | string | Unique opens |
| `linkclicks` | string | Total link clicks |
| `sdate` | string | Scheduled send date |
| `cdate` | string | Created date |

Returns `[]` on API error.

---

### `getCampaign(id): Promise<ACCampaign | null>`

Fetch a single campaign by ID.

Returns `null` on 404 or API error.

---

### `createCampaign(input): Promise<ACCampaign | null>`

Create a new email campaign.

**`CreateCampaignInput` fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Campaign name |
| `subject` | string | Yes | Email subject |
| `fromname` | string | Yes | Sender display name |
| `fromemail` | string | Yes | Sender email address |
| `listId` | string | Yes | ActiveCampaign list ID to send to |
| `htmlcontent` | string | No | HTML email body |
| `textcontent` | string | No | Plain text email body |
| `sdate` | string | No | Schedule date — if set, status becomes `1` (scheduled) |

Returns `null` on API error.

---

### `listACContacts(limit?): Promise<ACContact[]>`

Fetch recent contacts sorted by creation date descending.

**Default limit:** 20

**`ACContact` shape:** `id`, `email`, `firstName`, `lastName`, `cdate`, `udate`

Returns `[]` on API error.

---

### `listACLists(): Promise<ACList[]>`

Fetch all contact lists (up to 100).

**`ACList` shape:** `id`, `name`, `subscriber_count`

Returns `[]` on API error.

---

### `listAutomations(): Promise<ACAutomation[]>`

Fetch all automation workflows (up to 50).

**`ACAutomation` shape:** `id`, `name`, `status`, `entered`, `exited`

Returns `[]` on API error.

---

### `getEmailStats(): Promise<EmailStats>`

Aggregate contact, campaign, and list totals in a single call (3 parallel requests).

```typescript
const stats = await getEmailStats();
// { totalContacts: 1200, totalCampaigns: 45, totalLists: 8 }
```

Returns zeroed stats on API error.

---

## Admin API Routes

All routes require a valid Cognito admin JWT. They all return `503` when ActiveCampaign is not configured.

| Route | Method | Description |
|---|---|---|
| `/api/admin/email/campaigns` | GET | List campaigns. Query: `?limit=20` |
| `/api/admin/email/campaigns` | POST | Create campaign. Body: `CreateCampaignInput` |
| `/api/admin/email/campaigns/[id]` | GET | Get single campaign |
| `/api/admin/email/contacts` | GET | List contacts. Query: `?limit=20` |
| `/api/admin/email/lists` | GET | List all contact lists |
| `/api/admin/email/automations` | GET | List automations |
| `/api/admin/email/stats` | GET | Aggregate stats |

---

## Admin UI

`src/app/[locale]/admin/email/page.tsx` — tabbed interface with three tabs:

1. **Campaigns** — paginated campaign list with open/click stats; create campaign form
2. **Contacts** — recent contacts table
3. **Automations** — automation list with entry/exit counts

When ActiveCampaign is not configured, the UI shows a yellow banner with setup instructions.

---

## Setup

### 1. Get API credentials

1. Log in to ActiveCampaign
2. Go to **Settings** (bottom-left) → **Developer**
3. Copy the **API URL** (e.g. `https://myaccount.api-us1.com`) and **API Key**

### 2. Configure locally

```bash
# .env.local
ACTIVECAMPAIGN_API_URL=https://myaccount.api-us1.com
ACTIVECAMPAIGN_API_TOKEN=your-api-key
```

### 3. Configure production

```bash
aws ssm put-parameter \
  --name "/cloudless/production/ACTIVECAMPAIGN_API_URL" \
  --type String \
  --value "https://myaccount.api-us1.com"

aws ssm put-parameter \
  --name "/cloudless/production/ACTIVECAMPAIGN_API_TOKEN" \
  --type SecureString \
  --value "your-api-key"
```

---

## Testing

```bash
# Run ActiveCampaign lib unit tests (mocks getConfig — no real API calls)
pnpm vitest run __tests__/activecampaign.test.ts

# Run email API route tests (mocks activecampaign.ts entirely)
pnpm vitest run __tests__/admin-email-api.test.ts
```

Test files use `vi.mock("@/lib/ssm-config")` / `vi.mock("@/lib/activecampaign")` so no real credentials or network calls are made.

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/activecampaign.ts` | AC API v3 client |
| `src/app/api/admin/email/campaigns/route.ts` | GET list / POST create |
| `src/app/api/admin/email/campaigns/[id]/route.ts` | GET single |
| `src/app/api/admin/email/contacts/route.ts` | GET contacts |
| `src/app/api/admin/email/lists/route.ts` | GET lists |
| `src/app/api/admin/email/automations/route.ts` | GET automations |
| `src/app/api/admin/email/stats/route.ts` | GET aggregate stats |
| `src/app/[locale]/admin/email/page.tsx` | Admin email hub UI |
| `__tests__/activecampaign.test.ts` | Lib unit tests |
| `__tests__/admin-email-api.test.ts` | API route tests |
