# Notion Projects & Sprint Management — Academy Skill

> Complete reference for Notion's project management features: task databases,
> sprints, sprint boards, views, GitHub integration, and planning workflows.
> Source: Notion Academy + Help Center (notion.com/help/sprints).

---

## Task Databases

A Task database is the foundation for project management in Notion.
It requires three **core properties**:

| Property | Type | Purpose |
|----------|------|---------|
| **Status** | Status | Track progress (To Do → In Progress → Done) |
| **Assignee** | Person | Who owns the task |
| **Due Date** | Date | When the task is due |

### Converting an existing database to Tasks
1. Database settings → More settings → **Turn into Tasks**
2. Map existing properties to status, assignee, and due date
3. Create new properties if needed
4. Confirm conversion

Once a Task database exists, assigned tasks appear in each member's
**My Tasks** view on the Home page.

### ID Property
Add unique identifiers to tasks: `+` property → **ID** → optionally add a prefix
(e.g., `TASK-`). IDs enable shortcut URLs like `notion.so/TASK-123`.

---

## Sprints

Sprints break work into fixed time periods (typically 1-2 weeks).

### Enabling Sprints
1. Open task database settings → More settings → **Sprints**
2. Select **Turn on sprints**
3. System auto-generates a **Sprint board** and **Sprints database** in sidebar

### Sprint Configuration

| Setting | Options | Notes |
|---------|---------|-------|
| **Duration** | 1–8 weeks | Changes mid-cycle update the current sprint end date |
| **Start on** | Any day of the week | Adjusts current sprint boundaries |
| **Incomplete tasks** | Move to next sprint / Move to backlog / Keep in original sprint | Applied on sprint completion |
| **Automated sprints** | On / Off | Auto-complete current sprint and create next on schedule |
| **Turn off sprints** | — | Permanently removes sprints infrastructure |

---

## Sprint Board Views

The Sprint board provides three built-in views:

### Current Sprint
Shows tasks in the active sprint, grouped by status. Team members drag cards
to update status (e.g., "To Do" → "In Progress" → "Done").

### Sprint Planning
Shows tasks across current, next, and previous sprints, plus unassigned
backlog items. Use this view to:
- Move tasks between sprints
- Balance workload across time periods
- Identify over/under-committed sprints

### Backlog
Contains all tasks not assigned to any sprint. Source of work to pull
into upcoming sprints during planning.

---

## Sprints Database

A separate database that tracks sprints themselves:

| View | Shows |
|------|-------|
| **Overview** | All sprints with key metadata |
| **Timeline** | Gantt-like view of sprint date ranges |

Open any sprint page to see its tasks, dates, and progress.

---

## Sprint Lifecycle

### Planning
1. Open **Sprint Planning** view
2. Drag unassigned tasks from backlog into the next sprint
3. Review capacity — check assignee workload
4. Confirm sprint scope

### Execution
1. Switch to **Current Sprint** view
2. Team members update task status by dragging cards
3. Monitor progress via board grouping

### Completion
1. Click **Complete sprint** in the Current Sprint view
2. Confirm next sprint dates
3. Choose handling for incomplete tasks:
   - Move to next sprint
   - Move to backlog
   - Retain in completed sprint

### Automated Sprints
Toggle on to skip manual completion. The system automatically:
- Completes the current sprint at its end date
- Creates the next sprint
- Moves incomplete tasks per your setting

**Holiday breaks**: Temporarily disable automated sprints during schedule
disruptions, then resume when ready.

---

## Database Views for Projects

### Table View
Spreadsheet layout. Best for bulk editing, sorting, and filtering many tasks.

### Board View (Kanban)
Cards grouped by status or any Select/Status property.
Drag-and-drop to update. Best for sprint execution.

### Timeline View (Gantt)
Shows tasks on a date-based timeline using start/end dates.
Best for capacity planning and dependency visualization.
- Supports **dependencies**: link blocking/blocked-by tasks
- Drag to adjust dates
- Zoom: day / week / bi-weekly / month

### Calendar View
Month/week grid placing tasks by due date. Good for deadline visibility.

### List View
Compact, title-focused. Good for quick scanning and triage.

### Gallery View
Card grid with cover images. Good for design projects, content calendars.

---

## Projects + Tasks Pattern

Notion recommends a **two-database** setup:

### Projects Database
Tracks high-level initiatives with properties like:
- Name, Status, Priority, Owner, Start Date, Due Date
- Description, Budget, Progress (number 0-100)
- Tags (multi-select), Type (Client/Internal/Maintenance)
- **Relation** → Tasks database

### Tasks Database
Tracks individual work items with properties like:
- Task name, Status, Priority, Assignee, Due Date
- Estimate (XS/S/M/L/XL), Type (Feature/Bug/Chore/Spike/Design)
- **Relation** → Projects database
- Sprint (managed by sprints feature)
- Labels (multi-select)

### Connecting them
Create a **two-way relation** between Projects and Tasks. Then use
**rollups** on the Projects database to aggregate task data:
- Count of tasks by status
- Percent complete
- Earliest/latest due dates

---

## GitHub Integration

Notion Projects integrates with GitHub for engineering workflows:

### What syncs
- Link GitHub PRs and issues to Notion tasks
- Auto-update task status based on PR state
- See PR status directly in the task page

### Setup
1. Install the Notion GitHub integration
2. Connect your repositories
3. Link PR/issue URLs to Notion pages via the GitHub property

---

## Formulas for Project Management

### Days until deadline
```
dateBetween(prop("Due Date"), now(), "days")
```

### Progress bar (from subtask rollup)
```
round(prop("Done Count") / prop("Total Count") * 100)
```

### Sprint velocity
```
filter(prop("Tasks"), current.prop("Status") == "Done").length()
```

### Overdue flag
```
if(
  and(prop("Due Date") < now(), prop("Status") != "Done"),
  style("OVERDUE", "b", "red"),
  ""
)
```

---

## Best Practices

1. **Keep sprints short** (1-2 weeks) for faster feedback loops.
2. **Use the Backlog** — don't assign everything to sprints upfront.
3. **Limit WIP**: Use board view filters to cap "In Progress" items per person.
4. **Review weekly**: Use Sprint Planning view to adjust upcoming sprints.
5. **Automate status**: Use automations to notify on blocked items.
6. **Archive completed**: Move Done tasks to an archive DB quarterly.

---

## Sources

- https://www.notion.com/help/sprints
- https://www.notion.com/help/guides/getting-started-with-projects-and-tasks
- https://www.notion.com/help/guides/product-engineering-notion-sprint-planning
- https://www.notion.com/help/guides/sprints-simplified-notions-sprint-tracking-system
- https://www.notion.com/help/guides/timeline-view-unlocks-high-output-planning-for-your-team
