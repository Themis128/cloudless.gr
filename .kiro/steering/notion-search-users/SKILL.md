---
name: notion-search-users
description: "Notion Search, Users, Comments, and File Upload APIs — search across pages and databases, list and retrieve users, create and read comments, upload files. Use this skill whenever the user wants to search Notion content, find pages or databases by title, work with Notion users or bot info, add or read comments on pages or blocks, upload files to Notion, or build search-powered features. Triggers on 'search Notion', 'find in Notion', 'Notion users', 'Notion comments', 'upload to Notion', 'Notion file upload', 'who am I in Notion', or any request about cross-workspace search, user management, commenting, or file handling in Notion."
---

# Notion Search, Users, Comments & File Upload

This skill covers the cross-cutting Notion APIs: search, user management, comments, and file uploads.

## Search

### POST `/v1/search`

Search all pages and databases the integration has access to.

```json
{
  "query": "meeting notes",
  "filter": {
    "value": "page",
    "property": "object"
  },
  "sort": {
    "direction": "descending",
    "timestamp": "last_edited_time"
  },
  "page_size": 20,
  "start_cursor": "<cursor>"
}
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Text to search for (searches titles). Optional — omit to list all. |
| `filter.value` | `"page"` or `"database"` | Restrict results to pages or databases only. |
| `filter.property` | `"object"` | Always `"object"` when filtering. |
| `sort.direction` | `"ascending"` or `"descending"` | Sort order. |
| `sort.timestamp` | `"last_edited_time"` | Only supported sort field. |
| `page_size` | number (1–100) | Results per page. Default 100. |
| `start_cursor` | string | Pagination cursor from previous response. |

**Response:**
```json
{
  "object": "list",
  "results": [ /* page or database objects */ ],
  "has_more": true,
  "next_cursor": "abc123",
  "type": "page_or_database"
}
```

**Important notes:**
- Search only returns objects shared with the integration
- Search indexes title/name — it does NOT search page content or property values
- Results include full page/database objects with all properties
- For content search, query each database individually with title/rich_text filters
- Rate limit applies: ~3 req/s average

### Search Patterns

**Find all databases:**
```json
{ "filter": { "value": "database", "property": "object" } }
```

**Find pages matching a title:**
```json
{ "query": "Q1 Report", "filter": { "value": "page", "property": "object" } }
```

**Paginate through all pages:**
```typescript
async function searchAll(query: string): Promise<Page[]> {
  const results: Page[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionFetch("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query, start_cursor: cursor, page_size: 100 }),
    });
    const data = await res.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}
```

---

## Users

### GET `/v1/users/me`

Returns the bot user associated with the integration token. Useful for identifying the integration itself.

**Response:**
```json
{
  "object": "user",
  "id": "uuid",
  "type": "bot",
  "name": "My Integration",
  "avatar_url": null,
  "bot": {
    "owner": { "type": "workspace", "workspace": true },
    "workspace_name": "My Workspace"
  }
}
```

### GET `/v1/users/{user_id}`

Retrieve a specific user by ID.

**Response:**
```json
{
  "object": "user",
  "id": "uuid",
  "type": "person",
  "name": "John Doe",
  "avatar_url": "https://...",
  "person": { "email": "john@example.com" }
}
```

### GET `/v1/users`

List all users in the workspace. Paginated.

**Response:**
```json
{
  "object": "list",
  "results": [ /* user objects */ ],
  "has_more": false,
  "next_cursor": null
}
```

**User types:**
- `"person"` — workspace members, with `person.email`
- `"bot"` — integrations, with `bot.owner` and `bot.workspace_name`

---

## Comments

### POST `/v1/comments`

Create a comment on a page or as a reply in a discussion thread.

**Comment on a page (new discussion):**
```json
{
  "parent": { "page_id": "<page-uuid>" },
  "rich_text": [
    { "text": { "content": "This looks great! Let's ship it." } }
  ]
}
```

**Reply to an existing discussion:**
```json
{
  "discussion_id": "<discussion-uuid>",
  "rich_text": [
    { "text": { "content": "Agreed, merging now." } }
  ]
}
```

The `rich_text` array supports the same format as block rich text (annotations, links, mentions).

### GET `/v1/comments?block_id={block_id}`

List comments on a page or block. The `block_id` parameter is required — use a page ID to get all page-level comments.

**Query parameters:**
- `block_id` (required) — page or block UUID
- `start_cursor` — pagination cursor
- `page_size` — results per page (max 100)

**Response:**
```json
{
  "object": "list",
  "results": [
    {
      "object": "comment",
      "id": "uuid",
      "parent": { "type": "page_id", "page_id": "..." },
      "discussion_id": "uuid",
      "created_time": "2026-04-13T10:00:00.000Z",
      "last_edited_time": "2026-04-13T10:00:00.000Z",
      "created_by": { "object": "user", "id": "..." },
      "rich_text": [
        { "type": "text", "text": { "content": "..." }, "plain_text": "..." }
      ]
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

---

## File Upload

Notion supports a 3-step file upload process (API version 2022-06-28+).

### Step 1: Create Upload Session

**POST** `/v1/files/upload`

```json
{
  "file_name": "report.pdf",
  "content_type": "application/pdf",
  "content_length": 1048576
}
```

**Response:**
```json
{
  "id": "upload-uuid",
  "status": "not_started",
  "file_url": null
}
```

### Step 2: Send File Bytes

**PUT** `/v1/files/upload/{upload_id}/send`

Send the raw file bytes as the request body with the appropriate `Content-Type` header.

### Step 3: Complete Upload

**POST** `/v1/files/upload/{upload_id}/complete`

Finalizes the upload and returns the hosted file URL.

**Response:**
```json
{
  "id": "upload-uuid",
  "status": "uploaded",
  "file_url": "https://prod-files-secure.s3.us-west-2.amazonaws.com/..."
}
```

The returned `file_url` can then be used in file-type block or property values with `"type": "file"`.

**Size limits:** Files up to 5MB per upload. For larger files, use external URLs.

---

## Integration Capabilities Check

A useful pattern to verify what the integration can access:

```typescript
async function checkIntegration() {
  // Who am I?
  const me = await notionFetch("/v1/users/me");
  console.log("Bot:", me.name, "Workspace:", me.bot.workspace_name);

  // What can I see?
  const { results } = await notionFetch("/v1/search", {
    method: "POST",
    body: JSON.stringify({ page_size: 100 }),
  });

  const pages = results.filter((r: any) => r.object === "page");
  const dbs = results.filter((r: any) => r.object === "database");
  console.log(`Access: ${pages.length} pages, ${dbs.length} databases`);
}
```

---

## Error Handling

All endpoints share the same error codes:

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check request body format |
| 401 | Unauthorized | Verify API key |
| 403 | Forbidden | Object not shared with integration |
| 404 | Not found | Check UUID |
| 409 | Conflict | Retry (concurrent edit) |
| 429 | Rate limited | Exponential backoff, check `Retry-After` |

Rate limit: ~3 requests/second average across all endpoints.
