# Notion Database Query Filters & Sorts — Complete Reference

## Filter Structure

Every filter targets a `property` by name and applies a typed condition:

```json
{ "property": "PropertyName", "<type>": { "<operator>": <value> } }
```

## Compound Filters

```json
{ "and": [ { ...filter1 }, { ...filter2 } ] }
{ "or":  [ { ...filter1 }, { ...filter2 } ] }
```

Nesting supported up to two levels deep. You can combine `and`/`or`.

---

## Filter Operators by Property Type

### Rich Text / Title
```json
{ "property": "Name", "rich_text": { "contains": "search term" } }
```
Operators: `equals`, `does_not_equal`, `contains`, `does_not_contain`, `starts_with`, `ends_with`, `is_empty` (true), `is_not_empty` (true)

Title uses the same operators with `"title"` instead of `"rich_text"`.

### Number
```json
{ "property": "Score", "number": { "greater_than": 80 } }
```
Operators: `equals`, `does_not_equal`, `greater_than`, `greater_than_or_equal_to`, `less_than`, `less_than_or_equal_to`, `is_empty`, `is_not_empty`

### Checkbox
```json
{ "property": "Done", "checkbox": { "equals": true } }
```
Operators: `equals`, `does_not_equal` (boolean values only)

### Select
```json
{ "property": "Status", "select": { "equals": "Active" } }
```
Operators: `equals`, `does_not_equal`, `is_empty`, `is_not_empty`

The value can be a string or string array.

### Multi-Select
```json
{ "property": "Tags", "multi_select": { "contains": "urgent" } }
```
Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

### Status
```json
{ "property": "Status", "status": { "equals": "In Progress" } }
```
Operators: `equals`, `does_not_equal`, `is_empty`, `is_not_empty`

### Date
```json
{ "property": "Due Date", "date": { "on_or_before": "2026-04-30" } }
```
**Exact/range operators**: `equals`, `before`, `after`, `on_or_before`, `on_or_after`
Values: ISO 8601 date string (`"2026-04-13"`) or datetime (`"2026-04-13T00:00:00Z"`)

**Relative operators** (value is empty object `{}`):
`past_week`, `past_month`, `past_year`, `this_week`, `next_week`, `next_month`, `next_year`

**Empty checks**: `is_empty`, `is_not_empty`

### People
```json
{ "property": "Assignee", "people": { "contains": "<user-uuid>" } }
```
Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

Use `"me"` as value for the current bot user.

### Files
Operators: `is_empty`, `is_not_empty` only

### Relation
```json
{ "property": "Project", "relation": { "contains": "<page-uuid>" } }
```
Operators: `contains`, `does_not_contain`, `is_empty`, `is_not_empty`

### Unique ID
```json
{ "property": "ID", "unique_id": { "equals": 42 } }
```
Operators: `equals`, `does_not_equal`, `greater_than`, `greater_than_or_equal_to`, `less_than`, `less_than_or_equal_to`

### Formula
The filter type depends on the formula's result type. Wrap in `"formula"`:
```json
{ "property": "Computed", "formula": { "number": { "greater_than": 10 } } }
{ "property": "IsActive", "formula": { "checkbox": { "equals": true } } }
```

### Rollup
```json
{ "property": "TotalTasks", "rollup": { "number": { "greater_than": 5 } } }
{ "property": "AllComplete", "rollup": { "every": { "rich_text": { "is_not_empty": true } } } }
```
Array aggregations: `any`, `every`, `none` (with nested property filter).
Single value: `number`, `date` (with nested typed filter).

### Timestamp Filters
Filter by creation or edit time without a property name:
```json
{ "timestamp": "created_time", "created_time": { "after": "2026-01-01" } }
{ "timestamp": "last_edited_time", "last_edited_time": { "past_week": {} } }
```

---

## Sort Structure

```json
{
  "sorts": [
    { "property": "Priority", "direction": "descending" },
    { "property": "Name", "direction": "ascending" },
    { "timestamp": "created_time", "direction": "descending" }
  ]
}
```

**Direction**: `"ascending"` or `"descending"` (default: ascending)

**By property**: `{ "property": "PropertyName", "direction": "..." }`
**By timestamp**: `{ "timestamp": "created_time" | "last_edited_time", "direction": "..." }`

Sort order matters — earlier sorts take precedence. All sortable property types are supported (text, number, date, select, checkbox, etc.).

---

## Practical Examples

### Active items due this week
```json
{
  "filter": {
    "and": [
      { "property": "Status", "status": { "does_not_equal": "Done" } },
      { "property": "Due Date", "date": { "this_week": {} } }
    ]
  },
  "sorts": [{ "property": "Priority", "direction": "descending" }]
}
```

### Search by text with pagination
```json
{
  "filter": {
    "property": "Title",
    "title": { "contains": "serverless" }
  },
  "page_size": 20,
  "start_cursor": "abc123..."
}
```

### Published blog posts, newest first
```json
{
  "filter": {
    "property": "Published",
    "checkbox": { "equals": true }
  },
  "sorts": [
    { "property": "Date", "direction": "descending" }
  ]
}
```
