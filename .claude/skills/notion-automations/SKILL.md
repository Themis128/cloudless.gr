# Notion Automations & Workflows — Academy Skill

> Complete reference for Notion database automations, button actions,
> webhook integrations, and workflow patterns.
> Source: Notion Academy + Help Center (notion.com/help/database-automations).

---

## Overview

Database automations are **trigger → action** sequences that fire when
specific database changes occur. They are available on **paid plans** only
(Free tier is limited to Slack notification automations).

---

## Triggers

Every automation starts with one or more triggers. You can set whether the
automation fires when **any** trigger occurs or when **all** triggers occur.

### Trigger Types

| Trigger | Description | Notes |
|---------|-------------|-------|
| **Page added** | Fires when a new page is added to the database | — |
| **Property edited** | Fires when a specific property changes | Can narrow to: "is set to [value]" for select, person, number, text, relation properties |
| **Every {frequency}** | Recurring on a schedule (daily, weekly, monthly, etc.) | Configurable start/end dates and timezone. **Cannot** be combined with other trigger types |

### Multi-trigger timing
When multiple `is edited` triggers must **all** occur, the edits must happen
within a ~3 second window. If that's too restrictive, use separate automations.

---

## Actions

Actions execute sequentially. Multiple actions can be chained in a single automation.

| Action | What it does | Notes |
|--------|-------------|-------|
| **Edit property** | Change properties on the triggering page | Multi-select, people, and relation support add/remove (not just replace) |
| **Add page to** | Create a new page in a selected database | Can set properties on the new page |
| **Edit pages in** | Modify existing pages in a target database | Filter which pages to affect |
| **Send notification to** | Notify up to 20 workspace members | Can target a Person property or specific members |
| **Send mail to** | Send email from your Gmail account | Supports To, CC, BCC, subject, body with dynamic mentions, custom display name, reply-to |
| **Send webhook** | HTTP POST to a URL | Custom headers, select which DB properties to include in payload |
| **Send Slack notification to** | Post to a Slack channel | Plus/Business/Enterprise only. Creator-only editing |
| **Define variables** | Create custom variables using mentions + formulas | Use in subsequent actions for complex logic |

### Webhook Action Details

- **Method**: POST only (no GET, PUT, DELETE)
- **Authentication**: None required (use custom headers for API keys)
- **Payload**: Selected database properties (page content is NOT included)
- **Limit**: Max 5 webhook actions per automation
- **Testing**: Use `webhook.site` to inspect payloads
- **Error handling**: Failed webhooks show ⚠️ indicator; automation pauses until manually resumed
- **Enterprise control**: Workspace owners can disable webhooks via Settings → Connections

### Email Action Details

- **Sender**: Must be connected Gmail account
- **Recipients**: Person property, workspace member, or external email
- **Dynamic content**: Use mentions (`@property`) and formulas in subject and body
- **Reply-to**: Customizable address

---

## Variables in Automations

The **Define variables** action lets you create reusable values:

```
Variable: overdue_days
Value: dateBetween(now(), prop("Due Date"), "days")
```

Then reference `overdue_days` in subsequent actions (e.g., email body, property edits).

This enables patterns like:
- Marking sub-tasks complete when a parent task completes
- Calculating derived values and writing them to properties
- Conditional branching across multiple actions

---

## Button Actions

Buttons are a complementary automation mechanism. They live as a property
in a database or inline in a page, and execute on **click** (not on triggers).

Buttons support the same action types as database automations:
Edit property, Add page to, Edit pages in, Send notification,
Send mail to, Send webhook, Send Slack notification, Define variables.

### Database Buttons vs Inline Buttons
- **Database buttons**: A property column; each row has the same button config.
- **Inline buttons**: Placed anywhere in a page's content.

---

## Limitations & Gotchas

| Limitation | Details |
|-----------|---------|
| **No cascading** | Automations cannot trigger other automations |
| **Restricted pages** | Automations skip pages with restricted access (Private/Shared) |
| **Recurring + Edit** | The `Every {frequency}` trigger cannot use the `Edit property` action |
| **Slack formulas** | Formulas cannot be used inside Slack notification content |
| **Mentions scope** | Mentions and formulas work only in actions, not triggers |
| **Free plan** | Only Slack notification automations available |
| **Edit permissions** | Requires full database access to create/edit automations |

---

## Error Handling

| Error Type | Behavior |
|-----------|---------|
| **Setup errors** | Prevent automation creation until resolved |
| **Runtime errors** | Pause the automation; manual resume required |
| **Missing database** | Notification sent to automation creator |
| **Invalid connection** | (Gmail, Slack) Notification sent; automation paused |

---

## Troubleshooting Checklist

1. Are all triggers happening within ~3 seconds? (if using "all" mode)
2. Is the page restricted (Private/Shared)? Automations can't act on restricted pages.
3. Is the automation's view filtered to include the relevant items?
4. Are date properties empty? Create filtered views for date calculations.
5. Use specific triggers (`is set to`) instead of generic `is edited` when possible.
6. Test webhooks with webhook.site before connecting to production endpoints.

---

## Common Workflow Patterns

### Auto-assign status on creation
- **Trigger**: Page added
- **Action**: Edit property → Status = "New"

### Notify team on high-priority items
- **Trigger**: Priority is set to "Urgent"
- **Action**: Send notification to @channel-owner

### Sync to external system via webhook
- **Trigger**: Status is set to "Approved"
- **Action**: Send webhook → your API endpoint (include Name, ID, Status properties)

### Auto-complete parent when all children done
- **Trigger**: Status is edited
- **Action**: Define variable: `all_done = prop("Sub-tasks").every(current.prop("Status") == "Done")`
- **Action**: If all_done → Edit pages in parent DB → Status = "Done"

### Weekly digest email
- **Trigger**: Every Monday at 9:00 AM
- **Action**: Send mail to team → Subject: "Weekly Project Update"

---

## API: Creating Automations Programmatically

Automations are **not** exposed in the public Notion API (as of v2022-06-28).
They can only be created through the Notion UI. However, you can:

1. Use the **webhook action** to send data OUT of Notion to your API.
2. Use the **Notion API** to write data INTO Notion (create pages, update properties).
3. Combine both for bidirectional sync patterns.

---

## Sources

- https://www.notion.com/help/database-automations
- https://www.notion.com/help/webhook-actions
- https://www.notion.com/help/notion-academy/lesson/using-data-automations
- https://www.notion.com/help/guides/connect-tools-to-notion-api
