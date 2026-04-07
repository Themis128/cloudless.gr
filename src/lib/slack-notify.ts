import { getIntegrations } from "@/lib/integrations";

interface SlackMessage {
  text: string;
  blocks?: Record<string, unknown>[];
}

/**
 * Send a message to the configured Slack webhook.
 * Silently no-ops if SLACK_WEBHOOK_URL is not set.
 */
export async function slackNotify(message: SlackMessage): Promise<boolean> {
  const { SLACK_WEBHOOK_URL } = getIntegrations();
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch (err) {
    console.error("[Slack] Webhook failed:", err);
    return false;
  }
}

/** Pre-formatted notification for new contact form submissions */
export async function slackContactNotify(data: {
  name: string;
  email: string;
  company?: string;
  service?: string;
  message: string;
}): Promise<boolean> {
  return slackNotify({
    text: `New contact from ${data.name} (${data.email})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "\ud83d\udce8 New Contact Form Submission" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${data.name}` },
          { type: "mrkdwn", text: `*Email:*\n${data.email}` },
          { type: "mrkdwn", text: `*Company:*\n${data.company || "\u2014"}` },
          { type: "mrkdwn", text: `*Service:*\n${data.service || "\u2014"}` },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${data.message.slice(0, 2000)}` },
      },
    ],
  });
}

/** Pre-formatted notification for new orders */
export async function slackOrderNotify(data: {
  email: string;
  amount: string;
  sessionId: string;
}): Promise<boolean> {
  return slackNotify({
    text: `New order: ${data.amount} from ${data.email}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "\ud83d\udcb0 New Order" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Customer:*\n${data.email}` },
          { type: "mrkdwn", text: `*Amount:*\n${data.amount}` },
          { type: "mrkdwn", text: `*Session:*\n\`${data.sessionId.slice(0, 20)}...\`` },
        ],
      },
    ],
  });
}
