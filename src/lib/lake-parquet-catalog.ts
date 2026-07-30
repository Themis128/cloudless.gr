/** Shared bronze parquet catalog for lake explore (server + client safe). */

export const LAKE_PARQUET_CATALOG = [
  { id: "gsc", label: "GSC keywords", path: "lake/gsc-keywords/keywords.parquet" },
  { id: "stripe", label: "Stripe transactions", path: "lake/transactions/transactions.parquet" },
  {
    id: "espocrm-contacts",
    label: "EspoCRM contacts",
    path: "lake/espocrm-contacts/contacts.parquet",
  },
  {
    id: "espocrm-opps",
    label: "EspoCRM opportunities",
    path: "lake/espocrm-opportunities/opportunities.parquet",
  },
  { id: "sentry", label: "Sentry issues", path: "lake/sentry-issues/issues.parquet" },
  { id: "linkedin", label: "LinkedIn ads", path: "lake/linkedin-ads/insights.parquet" },
  { id: "n8n-wf", label: "n8n workflows", path: "lake/n8n-workflows/workflows.parquet" },
  { id: "clients", label: "Clients", path: "lake/clients/clients.parquet" },
  { id: "rfm", label: "RFM scores", path: "ml-parquet/scores_rfm.parquet" },
] as const;

export type LakeParquetCatalogId = (typeof LAKE_PARQUET_CATALOG)[number]["id"];

export function lakeParquetPathById(id: string): string | null {
  const hit = LAKE_PARQUET_CATALOG.find((entry) => entry.id === id);
  return hit ? hit.path : null;
}

export function isCatalogParquetPath(path: string): boolean {
  return LAKE_PARQUET_CATALOG.some((entry) => entry.path === path);
}
