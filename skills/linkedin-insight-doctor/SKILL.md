---
name: linkedin-insight-doctor
description: |
  Diagnose why the LinkedIn Insight Tag is not firing on cloudless.gr and why
  paid campaigns are reporting zero conversions despite spend. Walks through
  the four failure modes in order of likelihood — missing GitHub secret →
  consent-gated component → stale build → conversion definition mismatch —
  and produces a verdict. Triggered by phrases like "0 conversions",
  "insight tag not firing", "lintrk undefined", "linkedin tracking broken",
  "why is my campaign not converting", "no leads from linkedin",
  "linkedin not tracking", or any time the operator opens DevTools on
  `/[locale]/campaigns/*` and finds no `_linkedin_partner_id`.
---

# LinkedIn Insight Tag Doctor

When the Insight Tag is silent, **the JS bundle, not the ad creative, is
almost always the problem**. This skill captures the diagnostic path
verified on cloudless.gr in 2026-06.

> Companion to `linkedin-campaigns` (which covers *building* a campaign).
> This skill covers *diagnosing* why an existing one isn't tracking.

## Quick run

From the repo root:

```bash
bash scripts/linkedin-insight-doctor.sh
```

The script:
1. Reads SSM for `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` and `LINKEDIN_CAPI_ACCESS_TOKEN`.
2. Reads the GitHub Actions secret presence via `gh secret list`.
3. Fetches the live `/[locale]/campaigns/<slug>/` HTML and grepes the
   client JS chunks for the Partner ID literal.
4. Calls LinkedIn's Conversions API to confirm `linkedinConversionId` is
   recognised and `Active`.
5. Prints a structured verdict with the next single action.

Use this **before** assuming the campaign creative or audience is the
problem. Statistically, a $40 CPM with zero conversions is almost always
a tracking outage, not an ad outage.

## The four failure modes, in order of likelihood

### 1. Missing build-time secret (most common, 70%+ of cases)

**Symptom:** Live bundle contains the Insight Tag component code, but no
literal 6-8 digit Partner ID anywhere in any JS chunk. `window._linkedin_partner_id`
is `undefined`. No `licdn.com` script ever loads, regardless of consent.

**Why:** `.github/workflows/deploy-pi.yml` (or `deploy.yml`) reads
`secrets.NEXT_PUBLIC_LINKEDIN_PARTNER_ID` as a Docker build-arg. When the
GitHub secret is unset or empty, an empty string is baked into the
client bundle, the `LINKEDIN_PARTNER_ID &&` truthy check in
`src/app/[locale]/layout.tsx` skips the mount entirely, and the tag never
even tries to load.

**Fix:**

1. **LinkedIn Campaign Manager** → Account Assets → Insight Tag → copy the
   numeric Partner ID (7-8 digits).
2. **GitHub repo** → Settings → Secrets and variables → Actions → New
   repository secret:
   - Name: `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`
   - Value: that numeric ID
3. *(Same trip)* Generate a Conversions API access token via Campaign
   Manager → Data → Signals Manager → Direct API → Generate access token.
   Scopes: `rw_conversions`, `r_ads`. Tokens do not expire.
4. Set GitHub secret `LINKEDIN_CAPI_ACCESS_TOKEN` (server-only) with that
   token, and mirror it to SSM at `/cloudless/production/LINKEDIN_CAPI_ACCESS_TOKEN`
   so server-side code paths can read it via `getIntegrationsAsync()`.
5. Trigger a fresh deploy:
   ```bash
   gh workflow run deploy-pi.yml --ref main
   ```
   Or via the MCP: `mcp__cloudless-infra__frontend_deploy_cloudless_gr`.
6. Verify the new bundle contains the Partner ID literal (the doctor
   script does this automatically).

### 2. Marketing consent never accepted (15%)

**Symptom:** Bundle contains the Partner ID literal, but `window.lintrk`
is still undefined in real visitor sessions. Operator opening the page
themselves likely has `cl_consent` cookie already declined or unset.

**Why:** `LinkedInInsightTag.tsx` is consent-gated via
`useCookieConsent()`. The `useEffect` early-returns when
`preferences.marketing === false`. Mirrors the `ConsentGatedPixel` pattern.

**Fix is not a code change** — it is operational:

- Confirm the consent banner is reachable and visually clear on the
  campaign destination URL (LinkedIn ads send mobile-heavy traffic; the
  banner must be tappable on a phone).
- If the consent grant rate is < 30%, redesign the banner. Pre-checked
  "Accept all" buttons violate ePrivacy in the EU — don't do that.
- For end-to-end testing in your own browser: open DevTools → Application
  → Cookies → delete `cl_consent`, reload, accept marketing cookies in
  the banner, then check `window._linkedin_partner_id` is populated.

### 3. Stale build (10%)

**Symptom:** Secrets are set, but the latest deploy ran before the secret
was added.

**Why:** Build-args bake at image build time. The k3s rollout reuses the
same ECR image until a new SHA is built.

**Fix:**

```bash
gh workflow run deploy-pi.yml --ref main
```

Wait for the run to complete (~5-7 min on the omv build runner). Then
re-run the doctor script.

### 4. Conversion definition mismatch (5%)

**Symptom:** Bundle is correct, `lintrk` fires on the thanks page, but
Campaign Manager → Analyze → Conversions shows the conversion as
"Inactive" past 30 min.

**Why:** Either the conversion ID in `src/data/campaigns.ts` does not
match a live conversion in Campaign Manager, or the URL-match rule on
the conversion definition does not include the `/thanks?...` query
parameters that the live URL carries.

**Fix:**

1. In Campaign Manager → Conversions, find the conversion by ID.
2. Confirm:
   - **Match type:** "URL contains" (not "URL exact")
   - **URL pattern:** `/campaigns/<slug>/thanks`
   - **Status:** `Active` (auto-flips once a real fire is recorded)
3. If still inactive, add a CAPI-mirrored conversion (`type: CONVERSIONS_API`)
   and put its ID in `adPlatforms[platform=linkedin].capiConversionId`.
   See the `linkedin-campaigns` skill, Operating principles §2.

## What "good" looks like

After fixing, the live bundle should contain:

```js
w._linkedin_partner_id = "12345678";   // your real ID
w._linkedin_data_partner_ids = w._linkedin_data_partner_ids ?? [];
w._linkedin_data_partner_ids.push("12345678");
```

And the network panel on `/<locale>/campaigns/<slug>/` after consent should
show a request to:
`https://snap.licdn.com/li.lms-analytics/insight.min.js`

And on `/<locale>/campaigns/<slug>/thanks?...` a pixel request to:
`https://px.ads.linkedin.com/collect/?pid=12345678&...&conversionId=26846068`

If all three render, the campaign can resume.

## Cross-references

- Operating playbook: `skills/linkedin-campaigns/SKILL.md`
- Architecture reference: `docs/linkedin-campaigns.md`
- Component: `src/components/LinkedInInsightTag.tsx`
- Layout mount: `src/app/[locale]/layout.tsx` (lines 21-24, 93)
- Browser fire: `src/app/[locale]/campaigns/[slug]/thanks/ThanksConversion.tsx`
- Server CAPI: `src/app/api/campaigns/conversion/route.ts`
- LinkedIn docs: [Access the partner ID for your Insight Tag](https://www.linkedin.com/help/lms/answer/a417869/access-your-linkedin-partner-id?lang=en)
- LinkedIn docs: [Getting access to Conversions API](https://learn.microsoft.com/en-us/linkedin/marketing/conversions/getting-access-conversions?view=li-lms-2026-01)
