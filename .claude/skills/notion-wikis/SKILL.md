# Notion Wikis & Knowledge Management — Academy Skill

> Complete reference for Notion teamspaces, wikis, page verification,
> knowledge management patterns, sidebar organization, and archiving.
> Source: Notion Academy + Help Center (notion.com/help).

---

## Teamspaces

Teamspaces organize content by team or department within a workspace.
Every workspace starts with a **Default** teamspace.

### Access Levels

| Level | Who can see | Who can join | Best for |
|-------|------------|--------------|----------|
| **Open** | Everyone in the workspace | Anyone can join freely | Company-wide resources, general knowledge |
| **Closed** | Listed in teamspace browser but content hidden until joined | Must request access or be invited | Department-specific content (Engineering, Marketing) |
| **Private** | Only members know it exists | Invite-only | Sensitive projects, leadership, HR |

### Teamspace Membership

- **Owners**: Full control — manage members, settings, permissions, and content.
- **Members**: Create, edit, and organize pages within the teamspace.
- **Custom roles** (Enterprise): Define granular permissions per teamspace.

### Managing Teamspaces

| Action | How |
|--------|-----|
| **Create** | Sidebar → `+` next to Teamspaces |
| **Settings** | Click teamspace name → Settings (gear icon) |
| **Archive** | Teamspace settings → Archive teamspace |
| **Restore** | Settings & Members → Teamspaces → Archived → Restore |
| **Delete** | Only workspace owners; permanently removes all content |

### Default Teamspace

- Every workspace has one default teamspace.
- New members are automatically added to it.
- Cannot be archived or deleted.
- Best practice: use it for company-wide information (handbook, policies, onboarding).

---

## Wikis

Wikis are a page-level feature that turns any Notion page (or database)
into a structured knowledge base with verification, ownership, and
freshness tracking.

### Enabling Wiki Mode

1. Open a page in the sidebar.
2. Click `•••` (more menu) → **Turn into wiki**.
3. The page becomes a wiki root with built-in properties.

### Wiki Properties (Auto-Added)

| Property | Type | Purpose |
|----------|------|---------|
| **Verification** | Status | Verified / Unverified / Needs re-verification |
| **Owner** | Person | Responsible for keeping the page accurate |
| **Last verified** | Date | When the page was last verified |
| **Last edited** | Date | Auto-updated on any edit |

### Verification Workflow

1. **Owner** is assigned when a page is created or transferred.
2. Owner reviews content and clicks **Verify** → page is marked Verified
   with a timestamp.
3. After a configurable period (default: 90 days), the page status
   changes to **Needs re-verification**.
4. Owner receives a notification to re-verify.
5. If content is edited after verification, status may reset depending
   on workspace settings.

### Verification Statuses

| Status | Meaning | Visual Indicator |
|--------|---------|-----------------|
| **Verified** | Content is accurate and up to date | Green checkmark |
| **Needs re-verification** | Verification period has expired | Yellow warning |
| **Unverified** | Never verified or manually unverified | No indicator |

### Configuring Verification Period

Workspace owners can set the re-verification interval:
- Navigate to Settings & Members → General → Wiki settings
- Options: 30, 60, 90, 120, 180, or 365 days
- Applies workspace-wide

---

## Sidebar Organization

The sidebar is the primary navigation structure in Notion.

### Sidebar Sections

| Section | Contents |
|---------|----------|
| **Favorites** | Bookmarked pages for quick access (per user) |
| **Teamspaces** | All teamspaces the user belongs to |
| **Shared** | Pages shared directly with the user (not in a teamspace) |
| **Private** | Personal pages visible only to the user |

### Organization Best Practices

1. **Flat over deep**: Keep nesting to 3 levels max for discoverability.
2. **Consistent naming**: Use clear, descriptive page titles.
3. **Use icons**: Visual differentiation speeds up scanning.
4. **Pin important pages**: Add to Favorites for quick access.
5. **Group by function**: Use teamspaces to mirror org structure.

---

## Knowledge Management Patterns

### Hub-and-Spoke (Recommended)

A central **wiki hub** page links to topic-specific sub-pages:

```
📚 Knowledge Base (wiki root)
├── 🏢 Company Info
│   ├── Mission & Values
│   ├── Org Chart
│   └── Office Locations
├── 🛠️ Engineering
│   ├── Architecture Decisions
│   ├── Runbooks
│   └── API Documentation
├── 📋 Processes
│   ├── Onboarding
│   ├── Expense Policy
│   └── Code Review Guidelines
└── 📦 Product
    ├── Roadmap
    ├── Feature Specs
    └── Release Notes
```

### Database-Backed Wiki

Use a database as the wiki root for structured knowledge:

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | Article name |
| Category | Select | Topic grouping |
| Owner | Person | Content owner |
| Verification | Status | Freshness status |
| Tags | Multi-select | Cross-cutting labels |
| Last Verified | Date | Verification timestamp |
| Audience | Select | Who this is for (All, Engineering, New Hires) |

**Views to create:**
- **All Articles** (Table): Full list with filters and sorts
- **By Category** (Board): Grouped by category for browsing
- **Needs Review** (Table): Filtered to "Needs re-verification"
- **Recently Updated** (Table): Sorted by Last Edited descending

### Meeting Notes Wiki

A specialized wiki pattern for preserving institutional knowledge:

1. Create a **Meeting Notes** database in the relevant teamspace.
2. Properties: Title, Date, Attendees (Person), Type (Select), Tags,
   Action Items (Relation → Tasks database).
3. Use **templates** for recurring meeting types (standup, retro, 1:1).
4. Link action items to the Tasks database via relation.

---

## Page Templates

Templates standardize page creation within wikis and databases.

### Creating Templates

1. In a database, click `+` → **New template**.
2. Fill in default property values and page content.
3. Name the template (e.g., "Bug Report", "Meeting Notes", "RFC").

### Template Features

- **Default property values**: Pre-fill status, assignee, tags.
- **Pre-built content**: Headers, checklists, boilerplate text.
- **Repeat templates**: Auto-create pages on a schedule (daily, weekly).
- **Template buttons**: Add inline buttons that create pages from templates.

---

## Page History & Recovery

### Version History

- Every Notion page maintains edit history.
- **Free plan**: 7 days of history.
- **Plus plan**: 30 days.
- **Business/Enterprise**: 90 days.
- Access via `•••` → **Page history**.
- Restore any previous version (creates a new version, non-destructive).

### Trash & Recovery

- Deleted pages go to **Trash** (sidebar bottom).
- Pages remain in Trash for 30 days before permanent deletion.
- Workspace owners can view and restore any trashed page.
- Permanently deleted pages cannot be recovered.

---

## Archiving

### Page Archiving

Archiving removes a page from active views without deleting it:
- Right-click page → **Move to Trash** (moves to Trash, recoverable).
- For soft archiving: create an "Archive" section and move pages there.

### Teamspace Archiving

1. Teamspace settings → **Archive teamspace**.
2. All content becomes read-only and hidden from the sidebar.
3. Archived teamspaces appear in Settings → Teamspaces → Archived.
4. Can be restored at any time by a workspace owner.

### Archiving Best Practices

1. **Quarterly cleanup**: Review and archive stale pages every quarter.
2. **Status-based**: Use database automation to flag items not edited in 90+ days.
3. **Archive database**: Create a dedicated archive database and move completed items.
4. **Never delete wikis**: Archive instead — institutional knowledge has long-term value.

---

## Permissions & Sharing

### Permission Levels

| Level | Can do |
|-------|--------|
| **Full access** | Edit content, change settings, manage permissions |
| **Can edit** | Edit page content and properties |
| **Can edit content** | Edit page body but not properties |
| **Can comment** | View and add comments only |
| **Can view** | Read-only access |

### Inheritance

- Pages **inherit** permissions from their parent page or teamspace.
- Permissions can be **restricted** (narrowed) but not **expanded** beyond
  the parent's level.
- Moving a page to a different teamspace changes its permission context.

### Sharing Patterns

| Pattern | How | Use case |
|---------|-----|----------|
| **Teamspace-wide** | Add content to a teamspace | Team knowledge bases |
| **Page-level** | Share button → invite specific people | Cross-team collaboration |
| **Public link** | Share → "Share to web" | External documentation |
| **Guest access** | Invite external email | Client or vendor collaboration |

---

## Search & Discovery

### Notion Search

- **Quick Find**: `Cmd/Ctrl + P` — searches titles, content, and comments.
- **Filters**: Narrow by teamspace, created by, date, or content type.
- **Recent pages**: Quick Find shows recently visited pages first.

### Improving Discoverability

1. **Descriptive titles**: Include keywords people would search for.
2. **Tags/Categories**: Use multi-select properties for cross-referencing.
3. **Linked databases**: Surface the same content in multiple contexts.
4. **Table of contents**: Add TOC blocks to long wiki pages.
5. **Breadcrumbs**: Use breadcrumb blocks to show navigation context.
6. **Backlinks**: Notion auto-tracks which pages link to the current page.

---

## Integrations for Knowledge Management

### Synced Databases

Pull external data into Notion for a unified knowledge view:
- **GitHub**: Issues and PRs synced to a Notion database.
- **Jira**: Tickets synced for cross-team visibility.
- **Google Drive**: Embed or link documents.

### API-Powered Wikis

Use the Notion API to programmatically manage wiki content:

```json
POST /v1/pages
{
  "parent": { "database_id": "wiki-db-id" },
  "properties": {
    "Title": { "title": [{ "text": { "content": "New Article" } }] },
    "Category": { "select": { "name": "Engineering" } },
    "Owner": { "people": [{ "object": "user", "id": "user-id" }] },
    "Tags": { "multi_select": [
      { "name": "API" },
      { "name": "Documentation" }
    ]}
  }
}
```

---

## Best Practices Summary

1. **Assign owners** to every wiki page — unowned pages decay fastest.
2. **Enable verification** and set a 90-day cycle for critical docs.
3. **Use templates** to standardize new content creation.
4. **Keep hierarchy flat** — 3 levels max for sidebar navigation.
5. **Archive, don't delete** — institutional knowledge has compounding value.
6. **Review quarterly** — use "Needs re-verification" views to find stale content.
7. **Link liberally** — cross-references between pages improve discoverability.
8. **Use databases for structured wikis** — they scale better than nested pages.

---

## Sources

- https://www.notion.com/help/teamspaces
- https://www.notion.com/help/wiki
- https://www.notion.com/help/page-permissions
- https://www.notion.com/help/guides/how-to-build-a-wiki-for-your-engineering-team
- https://www.notion.com/help/guides/category/wikis-knowledge-management
- https://www.notion.com/help/page-history
