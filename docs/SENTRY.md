# Sentry Integration

Error tracking and monitoring via the [Sentry](https://sentry.io) API.

## Architecture

```mermaid
graph TB
    subgraph "Admin Dashboard"
        ErrorsPage["/api/admin/ops/errors"]
    end

    subgraph "src/lib/sentry.ts"
        GetIssues["getUnresolvedIssues()"]
        GetIssue["getIssue()"]
        UpdateStatus["updateIssueStatus()"]
        IsConfigured["isSentryConfigured()"]
    end

    subgraph "Sentry API"
        ProjectIssues["GET /projects/:org/:project/issues/"]
        IssueDetail["GET /issues/:id/"]
        IssueUpdate["PUT /issues/:id/"]
    end

    ErrorsPage --> GetIssues
    GetIssues --> ProjectIssues
    GetIssue --> IssueDetail
    UpdateStatus --> IssueUpdate
    IsConfigured -.->|checks env| SENTRY_AUTH_TOKEN

    style ErrorsPage fill:#1a1a2e,stroke:#00fff5,color:#e2e8f0
    style GetIssues fill:#1a1a2e,stroke:#00fff5,color:#e2e8f0
    style GetIssue fill:#1a1a2e,stroke:#00fff5,color:#e2e8f0
    style UpdateStatus fill:#1a1a2e,stroke:#00fff5,color:#e2e8f0
    style IsConfigured fill:#1a1a2e,stroke:#00fff5,color:#e2e8f0
    style ProjectIssues fill:#0d1117,stroke:#ff6b6b,color:#e2e8f0
    style IssueDetail fill:#0d1117,stroke:#ff6b6b,color:#e2e8f0
    style IssueUpdate fill:#0d1117,stroke:#ff6b6b,color:#e2e8f0
```

## API Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant Route as /api/admin/ops/errors
    participant Lib as sentry.ts
    participant Cfg as integrations.ts
    participant API as Sentry API

    Admin->>Route: GET /api/admin/ops/errors
    Route->>Lib: isSentryConfigured()
    Lib->>Cfg: isConfigured("SENTRY_AUTH_TOKEN")
    Cfg-->>Lib: true/false

    alt Not configured
        Route-->>Admin: 503 "Sentry not configured"
    else Configured
        Route->>Lib: getUnresolvedIssues({ limit: 20 })
        Lib->>API: GET /projects/cloudless/cloudless-gr/issues/
        API-->>Lib: Issue[]
        Lib-->>Route: SentryIssueList
        Route-->>Admin: 200 { issues, total, fetchedAt }
    end
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_AUTH_TOKEN` | Yes | — | Internal integration or user auth token |
| `SENTRY_ORG` | No | `cloudless` | Sentry organization slug |
| `SENTRY_PROJECT` | No | `cloudless-gr` | Sentry project slug |

Set these in environment variables or add to SSM under `/cloudless/production/`.

## Functions

### `getUnresolvedIssues(options?)`

Fetches unresolved issues from the project. Options:

- `limit` — Max issues to return (default: 20)
- `sort` — Sort field: `date`, `new`, `freq`, `users` (default: `date`)
- `query` — Sentry search query (default: `is:unresolved`)

Returns `SentryIssueList | null`.

### `getIssue(issueId)`

Fetches a single issue by its Sentry ID. Returns `SentryIssue | null`.

### `updateIssueStatus(issueId, status)`

Updates an issue to `resolved`, `ignored`, or `unresolved`. Returns `boolean`.

### `isSentryConfigured()`

Returns `true` if `SENTRY_AUTH_TOKEN` is set.

## Error Handling

All functions return `null` on failure (graceful degradation pattern).
The admin route returns:

- **503** — Sentry not configured
- **502** — Sentry API unreachable or errored
- **200** — Success with issue list

## SentryIssue Shape

```typescript
interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: "unresolved" | "resolved" | "ignored";
  permalink: string;
  shortId: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}
```
