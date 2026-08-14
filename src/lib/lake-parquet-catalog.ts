/** Shared bronze parquet catalog for lake explore (server + client safe). */

export const LAKE_PARQUET_CATALOG = [
  { id: "gsc", label: "GSC keywords", path: "lake/gsc-keywords/keywords.parquet" },
  { id: "gsc-countries", label: "GSC countries", path: "lake/gsc-countries/countries.parquet" },
  { id: "gsc-devices", label: "GSC devices", path: "lake/gsc-devices/devices.parquet" },
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
  {
    id: "espocrm-accounts",
    label: "EspoCRM accounts",
    path: "lake/espocrm-accounts/accounts.parquet",
  },
  { id: "espocrm-cases", label: "EspoCRM cases", path: "lake/espocrm-cases/cases.parquet" },
  {
    id: "espocrm-campaigns",
    label: "EspoCRM campaigns",
    path: "lake/espocrm-campaigns/campaigns.parquet",
  },
  { id: "sentry", label: "Sentry issues", path: "lake/sentry-issues/issues.parquet" },
  { id: "linkedin", label: "LinkedIn ads", path: "lake/linkedin-ads/insights.parquet" },
  { id: "n8n-wf", label: "n8n workflows", path: "lake/n8n-workflows/workflows.parquet" },
  { id: "n8n-ex", label: "n8n executions", path: "lake/n8n-executions/executions.parquet" },
  { id: "postiz-posts", label: "Postiz posts", path: "lake/postiz-posts/posts.parquet" },
  {
    id: "postiz-int",
    label: "Postiz integrations",
    path: "lake/postiz-integrations/integrations.parquet",
  },
  {
    id: "appflowy-ws",
    label: "AppFlowy workspaces",
    path: "lake/appflowy-workspaces/workspaces.parquet",
  },
  { id: "appflowy-users", label: "AppFlowy users", path: "lake/appflowy-users/users.parquet" },
  { id: "portals", label: "Client portals", path: "lake/portals/portals.parquet" },
  { id: "clients", label: "Clients", path: "lake/clients/clients.parquet" },
  { id: "rfm", label: "RFM scores", path: "ml-parquet/scores_rfm.parquet" },
  { id: "churn", label: "Churn scores", path: "ml-parquet/scores_churn.parquet" },
] as const;

export type LakeParquetCatalogId = (typeof LAKE_PARQUET_CATALOG)[number]["id"];

export function lakeParquetPathById(id: string): string | null {
  const hit = LAKE_PARQUET_CATALOG.find((entry) => entry.id === id);
  return hit ? hit.path : null;
}

export function isCatalogParquetPath(path: string): boolean {
  return LAKE_PARQUET_CATALOG.some((entry) => entry.path === path);
}
