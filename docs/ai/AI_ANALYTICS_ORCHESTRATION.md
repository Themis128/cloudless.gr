# AI Analytics Orchestration

This flow turns the Stripe DynamoDB event ledger into an admin-only analytics pipeline with preprocessing, Claude insight generation, connector-ready payloads, and PDF export.

## Endpoints

- `POST /api/admin/ai/analytics-orchestration`
- `POST /api/admin/ai/analytics-orchestration/pdf`

Both endpoints require an admin JWT via `requireAdmin`.

## Workflow

The orchestration runs four explicit stages:

1. `collect_data`
   Reads the selected analytics window from `STRIPE_TRANSACTIONS_TABLE` using the `ByDayAndTime` GSI when available, with a filtered scan fallback.

2. `preprocess_data`
   Computes operational metrics before Claude sees the data:
   - failure and processed rates
   - average revenue per event and per processed event
   - top revenue categories
   - strongest revenue days
   - top failure days
   - recent-window vs prior-window momentum
   - data quality notes for sparse samples and multi-currency windows

3. `generate_insights`
   Calls Claude with the compressed analytics package and returns strict JSON containing:
   - executive summary
   - key insights
   - risks
   - recommended next moves
   - scenario outcomes

4. `prepare_connectors`
   Produces connector-ready payloads for:
   - `quicksight`
   - `powerbi`
   - `tableau`
   - `lookerstudio`
   - `metabase`

## Request Body

```json
{
  "windowDays": 30,
  "connectors": ["quicksight", "powerbi"],
  "goals": [
    "Increase net retained revenue",
    "Reduce payment failure rate"
  ],
  "reportTitle": "Stripe Analytics Report"
}
```

### Validation

- `windowDays`: integer from `1` to `365`
- `connectors`: optional array from the allowed connector set above
- `goals`: optional array of non-empty strings
- `reportTitle`: optional non-empty string, used by the PDF endpoint

## JSON Response Shape

```json
{
  "workflow": [
    { "step": "collect_data", "status": "completed", "details": "..." },
    { "step": "preprocess_data", "status": "completed", "details": "..." },
    { "step": "generate_insights", "status": "completed", "details": "..." },
    { "step": "prepare_connectors", "status": "completed", "details": "..." }
  ],
  "snapshot": {
    "windowDays": 30,
    "generatedAt": "2026-05-03T00:00:00.000Z",
    "totals": {
      "events": 0,
      "revenueMinor": 0,
      "processed": 0,
      "failed": 0
    },
    "byCategory": {},
    "byStatus": {},
    "byCurrency": {},
    "dailyTrend": []
  },
  "preprocessed": {
    "windowDays": 30,
    "hasData": false,
    "failureRatePct": 0,
    "processedRatePct": 0,
    "averageRevenuePerEventMinor": 0,
    "averageDailyRevenueMinor": 0,
    "averageDailyEvents": 0,
    "revenuePerProcessedEventMinor": 0,
    "topRevenueCategories": [],
    "topFailureDays": [],
    "strongestRevenueDays": [],
    "momentum": {
      "comparisonWindowDays": 0,
      "recentRevenueMinor": 0,
      "priorRevenueMinor": null,
      "revenueDeltaPct": null,
      "recentFailureRatePct": 0,
      "priorFailureRatePct": null,
      "failureRateDeltaPct": null
    },
    "dataQuality": {
      "sparseWindow": false,
      "notes": []
    }
  },
  "report": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "risks": ["..."],
    "nextMoves": [
      {
        "move": "...",
        "rationale": "...",
        "expectedOutcome": "...",
        "confidence": "high",
        "timeframeDays": 14
      }
    ],
    "scenarioOutcomes": [
      {
        "scenario": "...",
        "expectedRevenueDeltaPct": 4,
        "expectedConversionDeltaPct": 3
      }
    ]
  },
  "connectorPayloads": [
    {
      "connector": "quicksight",
      "datasets": {
        "dailyTrend": [],
        "categoryBreakdown": {},
        "statusBreakdown": {},
        "currencyBreakdown": {}
      },
      "summaryMetrics": {
        "failureRatePct": 0,
        "processedRatePct": 0,
        "averageRevenuePerEventMinor": 0,
        "revenueDeltaPct": null,
        "failureRateDeltaPct": null,
        "topRevenueCategories": [],
        "dataQualityNotes": []
      },
      "chartRecommendations": ["..."],
      "serviceHints": ["..."]
    }
  ]
}
```

## PDF Export

`POST /api/admin/ai/analytics-orchestration/pdf` runs the same orchestration pipeline and returns a generated PDF download with:

- overview KPIs
- executive summary
- key insights
- risks
- recommended moves
- scenario outcomes
- connector notes
- data quality notes when present

The response headers are:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="analytics-report-YYYY-MM-DD.pdf"`
- `Cache-Control: no-store`

## DynamoDB Analytics Fields

The orchestration expects the webhook ledger to persist:

- `eventId`
- `eventType`
- `eventDay`
- `tagCategory`
- `tagStage`
- `stageCategory`
- `processingStatus`
- `receivedAt`
- `amountMinor`
- `currency`
- `expiresAt`

Primary analytics access is via the following GSIs when present:

- `ByTypeAndTime`
- `ByCategoryAndTime`
- `ByStageAndTime`
- `ByStageCategoryAndTime`
- `ByStatusAndTime`
- `ByDayAndTime`
- `ByCustomerAndTime`

## Failure Modes

- `401`: missing or invalid admin auth
- `400`: invalid body schema
- `503`: `ANTHROPIC_API_KEY` missing
- `500`: analytics read, orchestration, or PDF generation failure

## Operational Use

- Use the JSON endpoint to feed dashboards, BI ingestion, and downstream automation.
- Use the PDF endpoint for executive reviews, weekly reporting, or offline distribution.
- Compare projected scenario outcomes against the next reporting window to close the loop on actual impact.
