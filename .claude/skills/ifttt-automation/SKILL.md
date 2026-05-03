---
name: ifttt-automation
description: >
  Expert guidance for IFTTT automation — creating applets, connecting services,
  running actions/queries, and building "if this then that" workflows across 900+
  services. Use this skill whenever the user mentions IFTTT, applets, automation
  workflows, "if this then that", connecting services, triggers, actions, queries,
  "when X happens do Y", "automate posting", "cross-post to social media",
  "auto-share new blog posts", "notify me when", or any request to create
  automated workflows between web services. Also triggers on webhook, automation,
  service connection, "post to Instagram when", "tweet when", "send a notification
  when", "log to spreadsheet", "sync between platforms", or "schedule a post".
  Even if the user doesn't say "IFTTT" explicitly, use this skill when they want
  to automate actions across different web services or platforms.
---

# IFTTT Automation Skill

You are an expert in using IFTTT's MCP tools to create automations, connect services,
and run actions/queries for the cloudless.gr project.

## MCP Tool Reference

IFTTT MCP server UUID: `418288e6-2c4e-48f8-8412-0b00c81b7f9d`

### Available Tools

| Tool | Purpose |
|------|---------|
| `get_services` | List services connected by the authenticated user |
| `search_services` | Search for services by name or description |
| `connect_service` | Check connection status and get OAuth URL to connect a service |
| `get_steps` | Get triggers, actions, and queries for one or more services (preferred over individual get_triggers/get_actions/get_queries) |
| `get_triggers` | Get triggers for a specific service |
| `get_actions` | Get actions for a specific service |
| `get_queries` | Get queries for a specific service |
| `create_applet` | Create and enable a new custom applet |
| `search_applets` | Search published applets by keyword |
| `get_applet` | Get details of a published applet by slug |
| `enable_applet` | Enable a published applet (auto-configure or with custom config) |
| `my_applets` | List the user's configured applets |
| `run_action` | Run a one-off action on a connected service |
| `run_query` | Run a one-off query on a connected service |
| `get_user_info` | Get authenticated user details |
| `geocode` | Convert an address to lat/lng (for location-based triggers/actions) |

## Core Concepts

### Applet Structure: "If This Then That"

Every IFTTT applet has:
1. **Trigger** ("If This") — the event that starts the applet (exactly one required)
2. **Queries** (optional) — fetch additional data before actions run
3. **Actions** ("Then That") — what happens when the trigger fires (at least one required)

### Ingredients

Triggers and queries produce **ingredients** — dynamic values that can be used in action
fields. For example, a "New blog post" trigger might produce `{{Title}}`, `{{Url}}`,
`{{Content}}` ingredients that you can use in a "Post to Facebook" action.

### Step Templates

When using `get_steps` or individual step tools, the response includes a `step_template`
object. Copy this template, fill in `account_id` and `fields`, then pass it to
`create_applet`, `run_action`, or `run_query`.

## Workflow: Connecting a New Service

1. Call `search_services(term="facebook")` to find the service slug
2. Call `connect_service(service_slug="facebook")` to check status
3. If not connected, it returns a `connect_url` — open it for the user to authenticate
4. After auth, call `connect_service` again to verify (or use `wait=true` to poll)

## Workflow: Creating a Custom Applet

1. **Discover steps**: Call `get_steps` with the services and step types you need:
   ```
   get_steps(services=[
     {service_slug: "wordpress", step_types: ["triggers"]},
     {service_slug: "facebook_pages", step_types: ["actions"]}
   ])
   ```
2. **Review fields**: Each step has fields with `prompt_guidance` — follow these to
   determine what values to set. Fields with defaults can be accepted as-is.
3. **Build the applet**: Call `create_applet` with:
   - `name`: descriptive name (e.g., "Share new blog posts to Facebook")
   - `trigger`: copy `step_template` from trigger, fill `account_id` + `fields`
   - `queries`: optional array of query step templates
   - `actions`: array of action step templates (at least one)
   - `description`: optional but recommended
   - `actions_delay`: optional delay in seconds (max 14,145 ≈ 4 hours)

## Workflow: Enabling a Published Applet

1. `search_applets(query="share blog post facebook")` — find relevant applets
2. `get_applet(slug="applet-slug")` — review details
3. `enable_applet(slug="applet-slug")` — auto-configures with defaults if possible
4. If fields need input, fill `configuration_template` and call `enable_applet` again

## Workflow: Running One-Off Actions/Queries

Use `run_action` and `run_query` for immediate, one-time operations (not recurring):

```
run_action(
  service_slug="facebook_pages",
  slug="create_a_link_post",
  account_id: 12345,
  fields: { link_url: "https://cloudless.gr/blog/new-post", message: "Check out our latest!" }
)
```

## Field Types

When filling step template fields:
- **TEXT**: string value
- **COLLECTION_SELECT**: choose from `options` list
- **LOCATION**: use `{latitude, longitude}` or `{latitude, longitude, radius_in_meters}` — use `geocode` tool to convert addresses

## Connected Services (cloudless.gr)

Check current connections with `get_services()`. Key services for cloudless.gr:

### Likely Connected
- Facebook Pages (for cloudless.gr page posts)
- WordPress / webhooks (for blog post triggers)

### Useful Services to Connect
- Instagram, LinkedIn, Twitter/X, Threads (social media cross-posting)
- Google Sheets (logging/analytics)
- Slack (notifications)
- Webhooks (custom integrations with Next.js API routes)
- RSS Feed (blog syndication triggers)

## Common Applet Patterns for cloudless.gr

### Auto-share blog posts to social media
- **Trigger**: WordPress "Any new post" or RSS "New feed item"
- **Action**: Facebook Pages "Create a link post", LinkedIn "Share an update", etc.

### Log form submissions
- **Trigger**: Webhooks "Receive a web request" (from Next.js contact form API route)
- **Action**: Google Sheets "Add row to spreadsheet"

### Notify on new lead
- **Trigger**: Webhooks "Receive a web request" (from HubSpot webhook or contact form)
- **Action**: Slack "Post to channel" or Email "Send me an email"

### Cross-post across platforms
- **Trigger**: Instagram "Any new photo by you"
- **Action**: Facebook Pages "Create a photo post", Twitter "Post a tweet with image"

## Important Notes

- Always call `get_steps` (preferred) or individual step tools BEFORE creating applets — never guess field names or slugs
- `get_steps` with `include_fields=false` is useful for lightweight browsing when scanning many services
- Published applets (`search_applets` + `enable_applet`) are often easier than custom ones for common patterns
- `actions_delay` max is 14,145 seconds (just under 4 hours)
- Ingredients from triggers/queries use `{{IngredientName}}` syntax in action fields
- The `geocode` tool converts addresses to coordinates for location-based fields
- IFTTT Pro features may be required for multi-action applets or queries
