---
name: postiz-automation
description: |
  Wire Postiz (self-hosted social scheduler) to the cloudless.gr automation
  stack — auto-append UTM parameters to post links, trigger n8n workflows
  on publish events, track campaign leads through EspoCRM, and notify
  #campaigns in Slack. Use when the user says "automate Postiz", "UTM on
  posts", "track LinkedIn campaign", "Postiz → Slack", "Postiz → n8n",
  or "which campaign drove this lead". Pairs with `n8n-operator` and `postiz`.
---

# Postiz automation

This skill covers the automation layer that sits **between** Postiz and the
rest of the cloudless.gr stack. Postiz handles scheduling and publishing;
this layer handles attribution, CRM sync, and Slack notifications.

## The full pipeline (how a campaign lead flows)

```
LinkedIn Ad
  └─ User clicks → cloudless.gr/en/?utm_source=linkedin&utm_campaign=shop_online_founding
       └─ Contact form filled
            └─ POST /api/contact
                 ├─ EspoCRM: upsertContact → createDeal (stage: Prospecting)
                 ├─ Slack #contacts: full Block Kit card
                 └─ Slack #campaigns: same card (when utmSource ∈ paid-social set)
```

## UTM convention for Postiz posts

Every link you share via Postiz **must carry UTM params** for the pipeline to
route the lead to `#campaigns`. The contact route checks `attribution.utmSource`
against this set (defined in `src/lib/slack-notify.ts: CAMPAIGN_UTM_SOURCES`):

```
linkedin | linkedin_ads | linkedin-ads
meta | facebook | instagram
google | google-ads | google_ads
tiktok | tiktok-ads
twitter | x-ads
```

**Template URL to use in Postiz posts:**

```
https://cloudless.gr/en/?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>&utm_content=<variant>
```

Replace:
- `<slug>` — your campaign name in snake_case (e.g. `shop_online_founding`)
- `<variant>` — the creative variant (e.g. `A_EN`, `B_EL`) for A/B tracking

## Postiz webhook → n8n (UTM guard)

The `postiz-utm-guard` n8n workflow (JSON: `infrastructure/n8n/workflows/postiz-utm-guard.json`)
catches posts published **without** UTM params and fires a `#campaigns` warning.

### How to wire it

1. **Import the workflow** into n8n (see `n8n-operator` skill → Importing a workflow).
2. **Activate** the workflow — copy its webhook URL:
   `https://n8n.cloudless.gr/webhook/postiz-published`
3. **Register the webhook in Postiz:**
   Postiz UI → Settings → Webhooks → Add → URL = step 2 URL →
   Event = `Post Published` → Save.
   *(Postiz v2.11.2 supports this under Settings → Integrations → Webhooks).*
4. **Test**: schedule a post with a bare URL (no UTM). After it publishes,
   check `#campaigns` for the warning message.

### What the workflow does

```
Postiz POST webhook
  └─ Extract: postUrl, platform, scheduledAt, content snippet
       └─ Check: does postUrl contain utm_source=?
            ├─ YES → log only (no alert)
            └─ NO  → Slack #campaigns: ⚠️ "Post published without UTM params"
                      + platform, URL, scheduled time
                      + "Edit post in Postiz" button
```

## Postiz API — schedule a post from code

The cloudless.gr Next.js app calls Postiz via `src/lib/postiz.ts`.
To schedule a new post programmatically (e.g. from an n8n workflow or admin action):

```bash
POSTIZ_API_KEY=$(aws ssm get-parameter --name /cloudless/production/POSTIZ_API_KEY \
  --with-decryption --query Parameter.Value --output text)
INTEGRATION_ID="<LinkedIn integration ID from Postiz UI>"

curl -X POST https://postiz.cloudless.gr/api/public/v1/posts \
  -H "Authorization: $POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "schedule",
    "date": "2026-07-01T09:00:00.000Z",
    "shortLink": false,
    "tags": ["campaign", "linkedin"],
    "posts": [{
      "integration": { "id": "'"$INTEGRATION_ID"'" },
      "value": [{
        "content": "Your post text here.\n\nhttps://cloudless.gr/en/?utm_source=linkedin&utm_medium=social&utm_campaign=shop_online_founding&utm_content=A_EN",
        "image": []
      }],
      "settings": { "__type": "linkedin" }
    }]
  }'
```

**Always include `image: []`** — Postiz v2.11.2 rejects bodies without it.

## Postiz → EspoCRM campaign attribution

When a lead arrives via a Postiz-driven campaign post, the EspoCRM deal
records the attribution automatically through the contact form pipeline:

- `lead_source`: `"contact_form"`
- `description`: includes the attribution summary (utm_source, utm_campaign, landing page)
- EspoCRM deal stage: `"Prospecting"`

To add campaign-specific fields to EspoCRM deals (e.g. `utm_campaign` as a
custom field), use the EspoCRM admin UI: Admin → Entity Manager → Opportunity
→ Fields → Add Field (type: Varchar, name: `utm_campaign`). Then update
`src/lib/espocrm.ts: createDeal()` to pass it.

## Postiz API key rotation

The API key is stored in SSM at `/cloudless/production/POSTIZ_API_KEY`.
To rotate:

1. Postiz UI → Settings → Public API → Regenerate.
2. Copy the new key.
3. `aws ssm put-parameter --name /cloudless/production/POSTIZ_API_KEY --value "<new>" --type SecureString --overwrite`
4. Restart the cloudless.gr app pod so it picks up the new SSM value:
   `kubectl -n cloudless rollout restart deploy/cloudless-app`

## Postiz integrations (connected social channels)

List all connected channels:

```bash
curl -H "Authorization: $POSTIZ_API_KEY" \
  https://postiz.cloudless.gr/api/public/v1/integrations | jq '.[] | {id, name, type}'
```

The `id` from this response is what you pass as `integration.id` in post bodies.

## Supported UTM platforms (auto-route to #campaigns)

These are checked in `src/lib/slack-notify.ts: CAMPAIGN_UTM_SOURCES`:

| utm_source value | Platform |
|---|---|
| `linkedin`, `linkedin_ads`, `linkedin-ads` | LinkedIn |
| `meta`, `facebook`, `instagram` | Meta |
| `google`, `google-ads`, `google_ads` | Google |
| `tiktok`, `tiktok-ads` | TikTok |
| `twitter`, `x-ads` | X / Twitter |

To add a new platform, edit the `CAMPAIGN_UTM_SOURCES` Set in `src/lib/slack-notify.ts`.

## Adding a new LinkedIn campaign (end-to-end checklist)

1. [ ] Create the campaign in LinkedIn Campaign Manager → note the `campaignId` and `conversionId`.
2. [ ] Add entry to `src/data/campaigns.ts` (if the campaign has a dedicated landing page).
3. [ ] Set `notifyChannels: [{ channel: "slack", target: "#campaigns", level: "event" }]`.
4. [ ] Schedule posts in Postiz with UTM params: `utm_source=linkedin&utm_campaign=<slug>`.
5. [ ] (Optional) Register the Postiz webhook → n8n `postiz-utm-guard` workflow to catch missing UTMs.
6. [ ] Verify: fill the contact form with `?utm_source=linkedin` → check `#campaigns` for the notification.

## Troubleshooting

| Symptom | Check |
|---|---|
| Lead not in `#campaigns` | Was `utm_source` in the URL? Check attribution in `#contacts` — the `Attribution:` line shows the raw UTM string |
| Postiz webhook not firing | Postiz UI → Settings → Webhooks → check the webhook is active and the URL is reachable |
| n8n workflow not triggering | `https://n8n.cloudless.gr` → check workflow is **active** (green toggle) |
| UTM guard fires on every post | The post URL didn't contain `utm_source=` — add it to the Postiz post content |
| Postiz API 401 | API key rotated but SSM/pod not updated — see key rotation steps above |
