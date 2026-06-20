/**
 * EspoCRM event → Slack message formatters.
 *
 * Routes each event type to a SlackClient pinned to a specific channel. The
 * client itself handles retry/backoff/webhook-fallback (per the
 * `feedback_slack_use_slackclient` memory) — we never call `chat.postMessage`
 * directly.
 *
 * Channel choices match the existing convention in src/lib/slack-notify.ts:
 *   #leads          new Contact / Lead
 *   #orders         new Opportunity, stage change, won/lost
 *   #notifications  new Case (support ticket), status change
 *   #notifications  catch-all for everything else
 */
import { SlackClient } from "@/lib/slack-notify";
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";

const leadsClient = new SlackClient({ channel: "#leads" });
const ordersClient = new SlackClient({ channel: "#orders" });
const notificationsClient = new SlackClient({ channel: "#notifications" });

function deepLinkFor(entity: string, id: string, baseUrl?: string): string {
  const root = (baseUrl ?? "https://espocrm.cloudless.gr").replace(/\/$/, "");
  return `${root}/#${entity}/view/${id}`;
}

function fmtMoney(amount?: number, currency?: string): string {
  if (amount === undefined || amount === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ─── Per-entity event handlers ──────────────────────────────────────────── */

export async function notifyContactCreated(rec: EspoEntityRecord, baseUrl?: string): Promise<void> {
  const url = deepLinkFor("Contact", rec.id, baseUrl);
  const name = rec.name ?? rec.emailAddress ?? rec.id;
  await leadsClient.post({
    text: `:wave: New contact in CRM — ${name}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: ":wave: New contact", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name*\n<${url}|${name}>` },
          rec.emailAddress ? { type: "mrkdwn", text: `*Email*\n${rec.emailAddress}` } : null,
          rec.phoneNumber ? { type: "mrkdwn", text: `*Phone*\n${rec.phoneNumber}` } : null,
          rec.assignedUserName
            ? { type: "mrkdwn", text: `*Owner*\n${rec.assignedUserName}` }
            : null,
        ].filter(Boolean) as Array<{ type: string; text: string }>,
      },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "Open in EspoCRM" }, url }],
      },
    ],
  });
}

export async function notifyLeadCreated(rec: EspoEntityRecord, baseUrl?: string): Promise<void> {
  await leadsClient.post({
    text: `:dart: New lead — ${rec.name ?? rec.id}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: ":dart: New lead", emoji: true } },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Name*\n<${deepLinkFor("Lead", rec.id, baseUrl)}|${rec.name ?? rec.id}>`,
          },
          rec.emailAddress ? { type: "mrkdwn", text: `*Email*\n${rec.emailAddress}` } : null,
        ].filter(Boolean) as Array<{ type: string; text: string }>,
      },
    ],
  });
}

export async function notifyOpportunityCreated(
  rec: EspoEntityRecord,
  baseUrl?: string
): Promise<void> {
  await ordersClient.post({
    text: `:moneybag: New opportunity — ${rec.name ?? rec.id}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":moneybag: New opportunity", emoji: true },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Name*\n<${deepLinkFor("Opportunity", rec.id, baseUrl)}|${rec.name ?? rec.id}>`,
          },
          rec.amount
            ? { type: "mrkdwn", text: `*Amount*\n${fmtMoney(rec.amount, rec.amountCurrency)}` }
            : null,
          rec.stage ? { type: "mrkdwn", text: `*Stage*\n${rec.stage}` } : null,
        ].filter(Boolean) as Array<{ type: string; text: string }>,
      },
    ],
  });
}

export async function notifyOpportunityStageChanged(
  rec: EspoEntityRecord,
  baseUrl?: string
): Promise<void> {
  const emoji =
    rec.stage === "Closed Won" ? ":tada:" : rec.stage === "Closed Lost" ? ":x:" : ":arrow_right:";
  await ordersClient.post({
    text: `${emoji} ${rec.name ?? rec.id} → ${rec.stage ?? "?"}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${emoji} *<${deepLinkFor("Opportunity", rec.id, baseUrl)}|${rec.name ?? rec.id}>*\n` +
            `Stage → *${rec.stage ?? "?"}*` +
            (rec.amount ? ` · ${fmtMoney(rec.amount, rec.amountCurrency)}` : ""),
        },
      },
    ],
  });
}

export async function notifyCaseCreated(rec: EspoEntityRecord, baseUrl?: string): Promise<void> {
  await notificationsClient.post({
    text: `:ticket: New case — ${rec.name ?? rec.id}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: ":ticket: New support case", emoji: true },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Subject*\n<${deepLinkFor("Case", rec.id, baseUrl)}|${rec.name ?? rec.id}>`,
          },
          rec.status ? { type: "mrkdwn", text: `*Status*\n${rec.status}` } : null,
          rec.assignedUserName
            ? { type: "mrkdwn", text: `*Assigned*\n${rec.assignedUserName}` }
            : null,
        ].filter(Boolean) as Array<{ type: string; text: string }>,
      },
    ],
  });
}

export async function notifyCaseStatusChanged(
  rec: EspoEntityRecord,
  baseUrl?: string
): Promise<void> {
  const emoji = rec.status === "Closed" ? ":white_check_mark:" : ":arrows_counterclockwise:";
  await notificationsClient.post({
    text: `${emoji} Case ${rec.name ?? rec.id} → ${rec.status ?? "?"}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${emoji} *<${deepLinkFor("Case", rec.id, baseUrl)}|${rec.name ?? rec.id}>*\n` +
            `Status → *${rec.status ?? "?"}*`,
        },
      },
    ],
  });
}
