/**
 * Shared self-hosted app catalog (safe for client + server).
 * Launch/autologin logic that talks to SSM lives in selfhosted-autologin.ts.
 */

export type SelfhostedApp = "appflowy" | "espocrm" | "n8n" | "postiz" | "grafana" | "kuma";

export const SELFHOSTED_APP_NAMES: Record<SelfhostedApp, string> = {
  appflowy: "AppFlowy",
  espocrm: "EspoCRM",
  n8n: "n8n",
  postiz: "Postiz",
  grafana: "Grafana",
  kuma: "Uptime Kuma",
};

/** Canonical public origins opened from the admin Self-hosted portal. */
export const SELFHOSTED_PUBLIC_URLS: Record<SelfhostedApp, string> = {
  appflowy: "https://appflowy.cloudless.gr",
  espocrm: "https://espocrm.cloudless.gr",
  n8n: "https://n8n.cloudless.gr",
  postiz: "https://postiz.cloudless.gr",
  grafana: "https://grafana.cloudless.gr",
  kuma: "https://kuma.cloudless.gr",
};
