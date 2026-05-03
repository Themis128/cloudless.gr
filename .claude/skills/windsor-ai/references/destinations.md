# Windsor.ai — Data Destinations Reference

Windsor pulls data from 25+ sources and pushes it to 20+ destinations. This doc exists to pick the right destination for a given task — especially for cloudless.gr where most reporting ends up in Notion / Next.js dashboards, not in a BI tool.

## Destination categories

### AI & Assistants
For Claude-driven analysis and chat workflows.

- **Claude** — direct MCP integration (what this whole skill is built on). Query via `get_data()` tool calls, synthesize in chat.
- **ChatGPT** — GPT-Actions integration, similar to MCP but for OpenAI
- **Gemini** — Google's AI assistant
- **Perplexity** — AI search
- **Copilot Agent** (Microsoft) — for Teams/Copilot Studio workflows
- **Cursor** — IDE integration for AI coding assistants
- **Manus AI** — agentic workflow tool

**When to use for cloudless.gr:** Claude is already wired in. Don't bother with the others unless a specific workflow requires them.

### Business Intelligence (BI) tools
Drag-and-drop dashboards for non-technical stakeholders.

- **Looker Studio** (formerly Data Studio) — free, Google-native, easy for GA4 crossovers. Best for shareable link-based dashboards.
- **Power BI** — Microsoft stack, great if the org runs on Microsoft 365
- **Tableau** — enterprise BI, premium polish, paid
- **Microsoft Fabric** — Microsoft's unified analytics platform (combines Power BI + data lake)

**When to use for cloudless.gr:** **Looker Studio** is the only BI tool that makes sense for a solo/small operation — free, hosted, shareable. Reach for it when a client or investor wants a polished link they can check themselves.

### Data warehouses
For long-term storage, historical analysis, joining with other business data.

- **BigQuery** — Google Cloud, pay-per-query, scales well, native to GA4
- **Snowflake** — enterprise-grade, separation of compute and storage
- **Azure SQL** — Microsoft managed SQL
- **Amazon Redshift** — AWS equivalent
- **Databricks** — Spark-based lakehouse

**When to use for cloudless.gr:** Overkill for current scale. Only consider BigQuery if you need >2 years of historical data or want to join Windsor data with other GA4 exports.

### Cloud object storage
Raw data dump for archival or custom downstream processing.

- **Amazon S3** — AWS blob storage
- **Azure Blob Storage** — Azure equivalent

**When to use:** Only for data-lake architectures. Skip for cloudless.gr.

### Spreadsheets & files
Lightweight, flat-file outputs.

- **Google Sheets** — native collab spreadsheet; perfect for ad-hoc analysis
- **Microsoft Excel** — offline spreadsheets

**When to use for cloudless.gr:** Google Sheets is ideal for one-off analyses or sharing raw numbers with a collaborator. Set up a Sheets destination for a connector + fields + date range, and Windsor refreshes the sheet on a schedule.

### Transactional databases
For applications that need marketing data in real-ish time.

- **MySQL** — commodity SQL
- **PostgreSQL** — richer SQL features
- **Azure SQL** — managed flavor

**When to use for cloudless.gr:** If the Next.js admin dashboard at cloudless.gr should pull marketing metrics from its own DB instead of calling Windsor's MCP live, pipe Windsor → Postgres → Next.js. But the MCP path is simpler for low QPS, so keep Postgres as a future optimization.

### Programming environments
For custom analysis, ML models, notebooks.

- **Python** — direct Python SDK / REST calls

**When to use for cloudless.gr:** For ad-hoc Jupyter analyses. The `./scripts/windsor-api.sh` helper already covers 80% of this.

## Choosing the right destination for a task

| Task | Destination | Why |
|------|-------------|-----|
| Ad-hoc question in chat | Claude (via MCP) | Already wired, no setup |
| Polished client/investor dashboard | Looker Studio | Free, shareable, easy branding |
| Raw numbers to share with a collaborator | Google Sheets | Zero friction, collaborative |
| Metric embedded in cloudless.gr admin dashboard | Next.js API calls MCP directly (no destination) | Destination would add latency + drift |
| Long-term historical analysis | BigQuery | Cheap storage, SQL queryable |
| Compare marketing to CRM/sales data | BigQuery + QuickBooks export → join with SQL | One warehouse, one source of truth |
| Daily automated report email | Google Sheets + a sheet-based automation (Apps Script or IFTTT) | Simpler than standing up a BI tool |

## Setting up a destination

Destinations are configured on the Windsor dashboard (not via MCP):

1. Log in to https://onboard.windsor.ai
2. Go to "Destinations" in the sidebar
3. Click the destination tile (e.g., Google Sheets)
4. Authenticate if needed (Google OAuth for Sheets, API key for Postgres, etc.)
5. **Pick the connector + account(s) + fields + date range** that should flow to this destination
6. **Set a refresh schedule** — hourly, daily, weekly
7. Save

Each destination = one data pipeline. If you want two GA4 reports with different field sets, create two destinations.

## Destinations vs. MCP

The MCP tools (`get_data`, `get_connectors`, etc.) are a **read-on-demand** API — Claude pulls fresh data every time you ask.

Destinations are **push-on-schedule** — Windsor writes data to an external system at a set cadence regardless of whether anyone is looking.

For cloudless.gr:
- Use **MCP** for interactive chat analysis, agent-driven Cowork workflows, and anything that feeds Next.js API routes
- Use **destinations** for scheduled sync to Sheets/Looker Studio where a stakeholder opens the tool at their own cadence

## Cost implications

- Most destinations bill **per destination slot**, not per row — a Sheets pipe and a Looker pipe are two slots
- MCP access does NOT count against destination slots
- TRIAL plan typically includes 1-2 destination slots; check https://onboard.windsor.ai/billing for current plan limits

## Current cloudless.gr destinations (2026-04-21)

None configured yet. All data access is via MCP (Claude) or the REST helper script. Next likely destination: **Google Sheets** for a weekly social-performance roll-up that non-technical clients can open.
