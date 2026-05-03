# Notion Databases & Properties — Academy Skill

> Reference for Notion database features: property types, views/layouts,
> relations, rollups, filters, sorts, groups, and sub-items.
> Source: Notion Academy + Help Center (notion.com/help).

---

## Database Layouts / Views

A single database can have **multiple views**, each with its own layout, filters,
sorts, and grouping. Available layouts:

| Layout     | Best for                                      |
|------------|-----------------------------------------------|
| **Table**  | Spreadsheet-style rows & columns              |
| **Board**  | Kanban / status-based cards (drag & drop)      |
| **List**   | Compact list of page titles                    |
| **Calendar** | Date-based items shown on month/week grid    |
| **Timeline** | Gantt-like view with start/end date bars     |
| **Gallery** | Card grid with cover images                   |

### View features
- **Filters** — show only items matching conditions (AND/OR logic).
- **Sorts** — order items by one or more properties (ascending/descending).
- **Group by** — visually cluster items by a Select, Status, Person, Date, etc.
- **Sub-items** — toggle on to show parent/child nesting within a view.
- **Dependencies** — link blocking/blocked-by tasks (available in Timeline).

---

## Property Types — Complete Reference

### Basic Properties

| Type            | Description                                     | API type        |
|-----------------|-------------------------------------------------|-----------------|
| **Title**       | Page name (every DB has exactly one)            | `title`         |
| **Text**        | Rich-text field for notes / descriptions        | `rich_text`     |
| **Number**      | Numeric value; format as number, currency, %    | `number`        |
| **Select**      | Single choice from a tag list                   | `select`        |
| **Multi-select** | Multiple tags from a list                      | `multi_select`  |
| **Status**      | Kanban-style progress (To-do → In Progress → Complete) | `status` |
| **Date**        | Single date or date range (time optional)       | `date`          |
| **Checkbox**    | Boolean true/false toggle                       | `checkbox`      |
| **URL**         | Clickable web link                              | `url`           |
| **Email**       | Clickable email address                         | `email`         |
| **Phone**       | Clickable phone number                          | `phone_number`  |
| **Person**      | Tag workspace members                           | `people`        |
| **File**        | Upload/attach files and images                  | `files`         |

### Computed / Auto Properties

| Type              | Description                                    |
|-------------------|------------------------------------------------|
| **Formula**       | Dynamic calculation from other properties       |
| **Relation**      | Link to pages in another database               |
| **Rollup**        | Aggregate data across a relation                |
| **Created Time**  | Auto timestamp when page was created            |
| **Created By**    | Auto person who created the page                |
| **Last Edited Time** | Auto timestamp of last edit                  |
| **Last Edited By** | Auto person who last edited                    |
| **ID**            | Auto-incrementing unique identifier             |
| **Button**        | Clickable action trigger                        |

### Place Property (newer)
Accepts locations (via search, name, or address). Stores coordinates for map-related features.

---

## Relations

Relations connect pages **between two databases** (or within the same database).

### Creating a relation
1. Add new property → choose **Relation**.
2. Pick the target database.
3. Optionally limit to **1 page** or allow **unlimited**.

### One-way vs Two-way

| Mode      | Behaviour                                              |
|-----------|-------------------------------------------------------|
| **One-way** (default) | Relation column only in the source database.  |
| **Two-way** | Toggle "Show on [target DB]" → creates a matching column in the target database. Edits sync both ways. |

### Self-relations
A database can relate to **itself** (e.g., task → subtask). Recommendation:
toggle **off** two-way for self-relations to avoid duplication issues.

### API endpoint
```
PATCH /v1/pages/{page_id}
{
  "properties": {
    "Relation": {
      "relation": [{ "id": "target-page-id" }]
    }
  }
}
```

---

## Rollups

Rollups **aggregate** data from related pages.

### Setup
1. The database must already have a **Relation** property.
2. Add a **Rollup** property → select: relation, target property, calculation.

### Available calculations

**General (any property type):**
Show original, Show unique values, Count all, Count values,
Count unique values, Count empty, Count not empty,
Percent empty, Percent not empty

**Number properties only:**
Sum, Average, Median, Min, Max, Range

**Date properties only:**
Earliest date, Latest date, Date range

### Limitations
- **Cannot** rollup a rollup (no nesting — would cause loops).
- Rollups can only be **sorted** when outputting numeric values.
- Exporting a relational DB as CSV flattens relations to plain-text URLs;
  re-importing does **not** restore relations.
- Duplicating a DB converts two-way relations to one-way.

---

## Database Performance Tips

- Limit views to **< 10** per database where possible.
- Use **filters** to reduce visible rows — Notion loads all visible rows.
- Avoid rollups that chain across many databases.
- Archive completed items to a separate database via automation.

---

## API Reference (Database Operations)

| Operation             | Method | Endpoint                          |
|-----------------------|--------|-----------------------------------|
| Query a database      | POST   | `/v1/databases/{id}/query`        |
| Create a database     | POST   | `/v1/databases`                   |
| Retrieve a database   | GET    | `/v1/databases/{id}`              |
| Update database props | PATCH  | `/v1/databases/{id}`              |
| Create a page (row)   | POST   | `/v1/pages`                       |
| Update a page         | PATCH  | `/v1/pages/{id}`                  |

### Query body example
```json
{
  "filter": {
    "and": [
      { "property": "Status", "select": { "equals": "In Progress" } },
      { "property": "Priority", "select": { "equals": "High" } }
    ]
  },
  "sorts": [
    { "property": "Due Date", "direction": "ascending" }
  ],
  "page_size": 50
}
```

### Filter operators by property type

| Property type | Operators                                                  |
|---------------|------------------------------------------------------------|
| text / rich_text | equals, does_not_equal, contains, does_not_contain, starts_with, ends_with, is_empty, is_not_empty |
| number        | equals, does_not_equal, greater_than, less_than, greater_than_or_equal_to, less_than_or_equal_to |
| select        | equals, does_not_equal, is_empty, is_not_empty              |
| multi_select  | contains, does_not_contain, is_empty, is_not_empty          |
| date          | equals, before, after, on_or_before, on_or_after, is_empty, is_not_empty, past_week, past_month, past_year, this_week, next_week, next_month, next_year |
| checkbox      | equals, does_not_equal                                      |
| people        | contains, does_not_contain, is_empty, is_not_empty          |
| relation      | contains, does_not_contain, is_empty, is_not_empty          |
| status        | equals, does_not_equal                                      |

---

## Sources

- https://www.notion.com/help/database-properties
- https://www.notion.com/help/relations-and-rollups
- https://www.notion.com/help/optimize-database-load-times-and-performance
- https://developers.notion.com/reference/property-object
