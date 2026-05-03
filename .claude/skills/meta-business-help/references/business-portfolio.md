# Business Portfolio — Structure, Assets, People

Meta's "Business Portfolio" (the product formerly known as Business Manager) is the container that holds all your business assets: Pages, Instagram accounts, ad accounts, Pixels, Catalogs, datasets. Without one, you cannot scale beyond personal-profile-owned assets.

## 1. Anatomy of a Business Portfolio

A Portfolio has:
- **An owner** (you, the person who created it)
- **Assets** — Pages, IG accounts, ad accounts, Pixels, Catalogs, Datasets (Events Manager), WhatsApp Business Accounts
- **People** — users with roles on the portfolio itself + specific permissions on each asset
- **Partners** — other businesses you've given asset access to (e.g., an ad agency)
- **Billing** — payment methods and tax info (separate from per-ad-account billing)

Assets within a portfolio get **portfolio-level permissions** layered on top of per-asset roles. A user can be:
- Admin on the portfolio (full access to all current + future assets)
- Employee on the portfolio (limited by per-asset role)
- Explicitly assigned to a specific asset without portfolio-wide access

## 2. Finding your portfolio(s)

One person can own multiple Portfolios (and is typically a member of several via work). See all of them at:

```
https://business.facebook.com/latest/select-business
```

or from any portfolio page, click the business name in the top-left to switch.

**cloudless.gr context:** Themis has TWO portfolios:
- `1558125105019725` — "Themistoklis Baltzakis" (auto-created, functional, has Page)
- `1526956002406847` — "cloudless.gr" (manually created, carries the IG link but flagged "can't advertise")

Decision recorded in auto-memory: keep everything in `1558125105019725`; do not try to use `1526956002406847` for advertising.

## 3. Adding assets to a Portfolio

### 3a. Adding a Facebook Page

Direct URL: `https://business.facebook.com/latest/settings/pages?business_id=<PORTFOLIO_ID>`

Three flows:
1. **Add a Page you own** — simplest, instant. You must be currently an admin of the Page on your personal profile.
2. **Claim a Page** — if another portfolio owns it, you request ownership. The current owner portfolio's admin must approve (or Meta support arbitrates if the request is legitimate business transfer).
3. **Request access (agency mode)** — you don't own the Page, you just need Admin/Editor/Advertiser access to do work. The Page admin grants access but retains ownership. THIS IS WHAT CAUSES "LITE MODE" — see `page-and-ig.md`.

**Gotcha:** A Page can only be OWNED by one portfolio at a time. If you try to add it to a second portfolio, Meta blocks with a misleading error like "Only people with full control…" — the real reason is ownership conflict elsewhere.

### 3b. Adding an Instagram Business account

Direct URL: `https://business.facebook.com/latest/settings/instagram_accounts?business_id=<PORTFOLIO_ID>`

Requirements:
- IG must already be a **Business** or **Creator** account (switch in IG mobile app → Settings → Account)
- You must know the IG login credentials OR the IG account must be linked to a Page inside the same portfolio

Flow:
1. Click "Add" → enter IG username + password OR "I already have access" (if linked via Page)
2. Meta then asks: "Which ad accounts should this IG be available in?" — pick your portfolio's ad accounts

**cloudless.gr gotcha:** The IG `@cloudless_gr` currently shows under the **People → business users** list in portfolio `1526956002406847` (NEW asset model) rather than in the classic `/instagram_accounts` page. Meta is mid-migration. If you can't find an IG account, check BOTH URLs.

### 3c. Creating or adding an ad account

See `ad-account.md` — this is its own multi-step process with billing setup.

### 3d. Adding a Pixel / Dataset

Settings → Data Sources → Pixels → Add.

Create new: pick a name, copy the Pixel ID, install on site via `<Script>` tag in Next.js app root.

Claim existing: same workflow as Page claim; owner must approve.

## 4. People and roles

Go to: Settings → People → Add

Portfolio-level roles:
- **Admin** — full access, can add/remove people and assets
- **Employee** — default role, permissions granted per-asset
- **Finance Analyst** — only sees billing / spend reports
- **Finance Editor** — can modify billing methods

Per-asset roles (set by assigning the person to specific assets):

For a **Page**:
- Full control (Admin) — can manage everything including roles
- Partial access: Create content, Messages and community activity, Community activity and messages, Ads, Insights, see `page-and-ig.md`

For an **ad account**:
- Admin — full access including billing
- Advertiser — can create/edit ads but not billing
- Analyst — read-only

For an **IG business account**:
- Full control
- Content creator
- Community manager
- Advertiser
- Insights analyst

### Inviting someone

1. Enter their personal Facebook email (must match the email on their FB account, not a work/alias)
2. Pick their portfolio role
3. Pick assets to grant access to + per-asset role
4. Meta sends them an invite; they accept via the link

## 5. "You can't use this business portfolio to advertise" — fixes

This error shows when your portfolio is flagged for one of several reasons. Try these in order:

### 5a. Check the restriction reason

URL: `https://business.facebook.com/latest/settings/info?business_id=<PORTFOLIO_ID>` → look for "Business restrictions" card.

Typical reasons:
1. **No verified business info** — fill in legal name, address, phone, website, tax ID (optional for EU sole proprietors but recommended)
2. **Policy violation** — a previous ad was flagged; portfolio entered review mode
3. **Suspicious activity** — multiple rapid asset changes triggered automated flag
4. **Incomplete business verification** — required for some regions / higher spend levels
5. **Unassigned ad account** — the portfolio has no ad account, so "advertising" is literally impossible (this is the cloudless.gr `1526956002406847` case)

### 5b. Start business verification

URL: `https://business.facebook.com/security/businessverification/?business_id=<PORTFOLIO_ID>`

What you need:
- Legal business name (matches tax documents)
- Business address (matches a utility bill or registration cert)
- Phone number (SMS or call verification)
- Website (optional but speeds approval)
- A document: business license, incorporation cert, VAT/tax certificate — EU sole proprietors often submit VIES / tax number

Greek sole proprietors can submit:
- VAT registration (AFM document) — primary
- Business license from the local Επιμελητήριο if registered
- Tax clearance certificate as backup

Review takes 3-10 business days typically.

### 5c. Appeal a policy rejection

URL: `https://business.facebook.com/business/accountquality?business_id=<PORTFOLIO_ID>` → find the flagged item → Request Review.

Keep appeals short + factual. Meta's review team is looking for a reason to approve; if you misrepresent, they'll reject permanently.

### 5d. Decision for cloudless.gr

For `1526956002406847` (the restricted one): **skip business verification**. The portfolio is empty of ads-worthy assets anyway. Just keep it around for the IG registration record.

For `1558125105019725` (the functional one): verify business identity preemptively so future ads don't hit the $250/lifetime "unverified business" spend cap.

## 6. Partner access (for agency scenarios)

If you want to work with an agency or the agency wants to work in your portfolio:

**You give agency access to YOUR portfolio's assets:**
- Settings → Partners → Add → Give a partner access to your assets → Enter partner portfolio ID → Pick assets + roles

**You access agency's portfolio:**
- Agency sends you an invitation link; accept and pick which of your portfolios links in

Partner relationships are per-asset; removing the partnership removes ALL asset access at once.

## 7. Deleting a portfolio

Settings → Business Info → scroll bottom → Permanently Delete Business.

**Warning:** This is irreversible and unlinks ALL assets. Pages/IG/ad accounts go back to their original individual owners. If you just want to clean up, it's usually better to REMOVE assets than delete the portfolio.

For cloudless.gr `1526956002406847`: **do not delete**. Doing so would unlink @cloudless_gr IG; reconnecting into the functional portfolio might fail if Meta's systems remember the old association. Leave it dormant.

## 8. Quick self-audit checklist

Run through this before launching ads to catch portfolio-level gaps:

- [ ] Portfolio has a clear business name and at least one asset of each type you need (Page, IG, ad account)
- [ ] You are Admin on the portfolio (not just Employee)
- [ ] Business info section has legal name, address, phone filled in
- [ ] Business verification is either completed or not required for your region/spend level
- [ ] At least one payment method is attached to the portfolio (used as default for new ad accounts)
- [ ] No "Business restrictions" warning visible on the Info page
- [ ] Pixel / Dataset created and attached to the ad account that will run the campaign
- [ ] Ad account has at least one Page attached under Business Info
- [ ] People section has a backup Admin (in case you lose account access)
