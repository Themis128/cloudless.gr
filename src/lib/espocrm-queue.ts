/**
 * Cloudflare Queues producer for EspoCRM webhook fan-out.
 * When ESPOCRM_QUEUE_PRODUCER_URL is set, the Pi webhook enqueues and returns
 * quickly; the Worker consumer handles Slack/n8n (see workers/espocrm-fanout).
 */

export type EspoQueueMessage = {
  entity: string;
  action: string;
  records: unknown[];
  enqueuedAt: string;
};

export function isEspoQueueConfigured(): boolean {
  return Boolean(
    process.env.ESPOCRM_QUEUE_PRODUCER_URL?.trim() &&
      process.env.ESPOCRM_QUEUE_PRODUCER_SECRET?.trim()
  );
}

export async function enqueueEspoWebhook(msg: Omit<EspoQueueMessage, "enqueuedAt">): Promise<boolean> {
  const url = process.env.ESPOCRM_QUEUE_PRODUCER_URL?.trim();
  const secret = process.env.ESPOCRM_QUEUE_PRODUCER_SECRET?.trim();
  if (!url || !secret) return false;

  const payload: EspoQueueMessage = {
    ...msg,
    enqueuedAt: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Espo queue producer ${res.status}: ${text.slice(0, 200)}`);
  }
  return true;
}
