---
name: chrome-browser-automation
description: >
  Expert guidance for Claude in Chrome browser automation — navigating websites,
  reading page content, clicking elements, filling forms, taking screenshots,
  running JavaScript, managing tabs, uploading files, recording GIFs, and
  automating web-based tasks. Use this skill whenever the user mentions Chrome,
  browser automation, "go to a website", "click on", "fill out a form", "take a
  screenshot", "read this page", "open a tab", "log into", "authenticate on",
  "check a website", "navigate to", web scraping, form submission, OAuth flow,
  "upload a file", visual testing, responsive testing, or any request that
  involves interacting with a web browser. Also triggers on "open Windsor.ai",
  "connect Instagram", "authenticate on Facebook", "check my website",
  "inspect this page", "debug in browser", or any task requiring browser
  interaction. Even if the user doesn't mention "Chrome" explicitly, use this
  skill when the task requires visiting, reading, or interacting with web pages.
---

# Claude in Chrome — Browser Automation Skill

You are an expert in using Claude in Chrome's MCP tools to automate browser
interactions for the cloudless.gr project — OAuth flows, website testing,
form filling, screenshots, and web-based admin tasks.

## MCP Tool Reference

### Tab & Context Management

| Tool | Purpose |
|------|---------|
| `tabs_context_mcp` | **ALWAYS call first** — get tab group context and available tab IDs |
| `tabs_create_mcp` | Create a new empty tab in the MCP tab group |
| `tabs_close_mcp` | Close a tab by ID |
| `switch_browser` | Connect to a different Chrome browser |

### Page Reading & Search

| Tool | Purpose |
|------|---------|
| `read_page` | Get accessibility tree of page elements (with ref IDs for interaction) |
| `get_page_text` | Extract raw text content (ideal for articles/blog posts) |
| `find` | Find elements by natural language (e.g., "login button", "search bar") |

### Navigation & Interaction

| Tool | Purpose |
|------|---------|
| `navigate` | Go to a URL, or "back"/"forward" in history |
| `computer` | Mouse clicks, typing, screenshots, scrolling, keyboard shortcuts, zoom, hover, drag |
| `form_input` | Set form element values using ref IDs from `read_page` |
| `browser_batch` | Execute multiple actions in one round trip (huge time saver) |

### File & Image Operations

| Tool | Purpose |
|------|---------|
| `file_upload` | Upload local files to file input elements (don't click file inputs — use this instead) |
| `upload_image` | Upload a screenshot/image to a file input or drag-drop target |

### JavaScript & Debugging

| Tool | Purpose |
|------|---------|
| `javascript_tool` | Execute JavaScript in page context (DOM, window, page variables) |
| `read_console_messages` | Read browser console (filter with `pattern` to avoid noise) |
| `read_network_requests` | Monitor HTTP requests (filter with `urlPattern`) |

### Visual Tools

| Tool | Purpose |
|------|---------|
| `resize_window` | Resize browser window (responsive testing) |
| `gif_creator` | Record browser actions and export as animated GIF |
| `shortcuts_list` | List available Chrome shortcuts/workflows |
| `shortcuts_execute` | Run a Chrome shortcut/workflow |

## Critical Rules

1. **Always call `tabs_context_mcp` first** before any other browser tool — you need valid tab IDs
2. **Each new conversation should create its own tab** with `tabs_create_mcp` rather than reusing existing tabs
3. **Never click file input elements** — use `file_upload` or `upload_image` instead (clicking opens a native dialog you can't interact with)
4. **Use `browser_batch` aggressively** — batch sequential actions (navigate → click → type → screenshot) in one call
5. **Take screenshots before clicking** — consult the screenshot to find correct coordinates
6. **Click center of elements** — don't click edges unless specifically needed

## Workflow: Starting a Browser Session

```
1. tabs_context_mcp(createIfEmpty=true)     → get group info
2. tabs_create_mcp()                         → create a fresh tab
3. navigate(url="https://example.com", tabId=<new_tab_id>)
4. computer(action="screenshot", tabId=<tab_id>)   → see the page
```

## Workflow: OAuth / Authentication Flows

Used frequently for connecting services (Windsor.ai, IFTTT, social media):

1. Get the OAuth URL from the relevant MCP tool (e.g., Windsor `get_connector_authorization_url`)
2. `navigate(url=<oauth_url>, tabId=<tab_id>)`
3. `computer(action="screenshot", tabId=<tab_id>)` — see what the auth page looks like
4. Use `find` to locate login fields, then `form_input` or `computer(action="type")` to fill credentials
5. Click authorize/grant buttons with `computer(action="left_click")`
6. Take screenshots at each step to track progress
7. After completion, verify back in the calling MCP tool

## Workflow: Reading and Extracting Page Content

```
# For structured element interaction:
read_page(tabId=<id>)                    → accessibility tree with ref IDs
read_page(tabId=<id>, filter="interactive")  → only buttons/links/inputs

# For raw text content:
get_page_text(tabId=<id>)                → clean text extraction

# For finding specific elements:
find(query="submit button", tabId=<id>)  → up to 20 matching elements with refs
```

### read_page Options
- `filter`: `"all"` (default) or `"interactive"` (buttons/links/inputs only)
- `depth`: max tree depth (default 15, reduce if output too large)
- `max_chars`: output limit (default 50000)
- `ref_id`: focus on a specific element subtree

## Workflow: Form Filling

```
1. read_page(tabId=<id>, filter="interactive")  → find form fields and their ref IDs
2. form_input(ref="ref_5", value="John", tabId=<id>)        → fill text field
3. form_input(ref="ref_6", value="john@example.com", tabId=<id>)  → fill email
4. form_input(ref="ref_7", value=true, tabId=<id>)           → check checkbox
5. form_input(ref="ref_8", value="Option A", tabId=<id>)     → select dropdown
6. computer(action="left_click", ref="ref_9", tabId=<id>)    → click submit
```

## Workflow: Browser Batch (Efficient Multi-Step)

Batch multiple sequential actions in ONE round trip:

```
browser_batch(actions=[
  {name: "navigate", input: {url: "https://cloudless.gr", tabId: 123}},
  {name: "computer", input: {action: "wait", duration: 2, tabId: 123}},
  {name: "computer", input: {action: "screenshot", tabId: 123}},
  {name: "find", input: {query: "contact form", tabId: 123}}
])
```

Actions execute **sequentially** and stop on first error. Coordinates in the batch
refer to the screenshot taken BEFORE the batch call. Cannot be nested.

## The `computer` Tool — Action Reference

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `screenshot` | Capture the visible viewport | `tabId` |
| `left_click` | Click at coordinates or ref | `coordinate` or `ref`, `tabId` |
| `right_click` | Right-click (context menu) | `coordinate`, `tabId` |
| `double_click` | Double-click | `coordinate`, `tabId` |
| `triple_click` | Triple-click (select line) | `coordinate`, `tabId` |
| `type` | Type text | `text`, `tabId` |
| `key` | Press keyboard keys | `text` (space-separated, e.g., "Enter", "cmd+a"), `tabId` |
| `scroll` | Scroll in a direction | `coordinate`, `scroll_direction`, `tabId` |
| `scroll_to` | Scroll element into view | `ref`, `tabId` |
| `hover` | Move mouse without clicking | `coordinate` or `ref`, `tabId` |
| `zoom` | Capture a region close-up | `region` [x0,y0,x1,y1], `tabId` |
| `left_click_drag` | Drag from start to end | `start_coordinate`, `coordinate`, `tabId` |
| `wait` | Wait N seconds (max 10) | `duration`, `tabId` |

**Modifiers** for click actions: `"ctrl"`, `"shift"`, `"alt"`, `"cmd"` — combine with `+`
(e.g., `"ctrl+shift"`).

**`save_to_disk`**: set `true` on screenshot/zoom to save image for sharing with user.

**`repeat`**: for `key` action, repeat 1-100 times (useful for arrow keys).

## GIF Recording

```
1. gif_creator(action="start_recording", tabId=<id>)
2. computer(action="screenshot", tabId=<id>)    → capture initial frame
3. ... perform actions ...
4. computer(action="screenshot", tabId=<id>)    → capture final frame
5. gif_creator(action="stop_recording", tabId=<id>)
6. gif_creator(action="export", download=true, tabId=<id>)
```

Options: `showClickIndicators`, `showActionLabels`, `showProgressBar`, `showWatermark`,
`quality` (1-30, lower = better quality).

## Common Tasks for cloudless.gr

### Test website responsiveness
```
resize_window(width=375, height=812, tabId=<id>)   → iPhone
resize_window(width=768, height=1024, tabId=<id>)  → iPad
resize_window(width=1920, height=1080, tabId=<id>) → Desktop
```

### OAuth service connection (Windsor.ai, IFTTT, etc.)
Navigate to auth URL → fill credentials → grant permissions → verify

### Inspect deployed site
Navigate to cloudless.gr → screenshot → read_page → check elements

### Debug API responses
Use `read_network_requests(urlPattern="/api/", tabId=<id>)` to monitor API calls

### Verify social media account settings
Navigate to platform settings pages (Instagram, Facebook, LinkedIn) to verify
account types, linked pages, and permissions

## Important Notes

- `read_page` output can be large — use `filter="interactive"` or `ref_id` to narrow scope
- `find` returns max 20 matches — use specific queries if too many results
- `javascript_tool` code runs in page context — do NOT use `return` statements, just write the expression
- Console messages: always provide a `pattern` filter to avoid noise
- Screenshots are the primary way to "see" what's on screen — take them frequently
- `browser_batch` cannot be nested inside itself
- For responsive testing, `resize_window` changes the actual browser window dimensions
