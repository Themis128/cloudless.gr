/**
 * Email concrete channel for the reusable ad-analytics module.
 *
 * Implements `NotificationChannel`. Renders the abstract `NotificationBlock`
 * set to plaintext + minimal HTML and sends via `sendEmail` (`@/lib/email`),
 * which already handles the Workers binding → Cloudflare Email API → Resend
 * fallback chain and the suppression list.
 *
 * `target` is a recipient email address (see `NotifyChannelConfig.target`).
 * `reply()` is a no-op — email has no thread concept here.
 */

import { isResendConfigured } from "@/lib/email-resend";
import { isCloudflareEmailConfigured } from "@/lib/email-cloudflare";
import { sendEmail } from "@/lib/email";
import type { NotificationBlock, NotificationChannel } from "./notification";

/** Slack mrkdwn → readable plaintext for email bodies. */
function stripMrkdwn(text: string): string {
  return text
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<mailto:[^|]+\|([^>]+)>/g, "$1");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

function render(blocks: NotificationBlock[]): Rendered {
  const lines: string[] = [];
  const htmlParts: string[] = [];
  let subject = "Cloudless Ads notification";

  for (const block of blocks) {
    switch (block.type) {
      case "header": {
        const t = block.text ?? "";
        subject = stripMrkdwn(t).slice(0, 150) || subject;
        lines.push(t.toUpperCase(), "");
        htmlParts.push(`<h2 style="margin:0 0 12px">${escapeHtml(stripMrkdwn(t))}</h2>`);
        break;
      }
      case "section": {
        if (block.fields?.length) {
          for (const f of block.fields) {
            const line = `${stripMrkdwn(f.title)}: ${stripMrkdwn(f.value)}`;
            lines.push(line);
            htmlParts.push(
              `<p style="margin:4px 0"><strong>${escapeHtml(stripMrkdwn(f.title))}</strong>: ${escapeHtml(stripMrkdwn(f.value))}</p>`
            );
          }
        } else if (block.text) {
          lines.push(stripMrkdwn(block.text));
          htmlParts.push(`<p style="margin:4px 0">${escapeHtml(stripMrkdwn(block.text))}</p>`);
        }
        lines.push("");
        break;
      }
      case "context": {
        if (block.text) {
          lines.push(`— ${stripMrkdwn(block.text)}`);
          htmlParts.push(
            `<p style="margin:4px 0;color:#666;font-size:12px">${escapeHtml(stripMrkdwn(block.text))}</p>`
          );
        }
        break;
      }
      case "divider": {
        lines.push("---");
        htmlParts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:12px 0">`);
        break;
      }
      default:
        if (block.text) {
          lines.push(stripMrkdwn(block.text));
          htmlParts.push(`<p style="margin:4px 0">${escapeHtml(stripMrkdwn(block.text))}</p>`);
        }
    }
  }

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;font-size:14px;color:#111;max-width:640px">${htmlParts.join("\n")}<p style="color:#999;font-size:11px;margin-top:24px">Cloudless · Clear skies. Zero friction.</p></body></html>`;
  return { subject, text: lines.join("\n").trim() + "\n", html };
}

export const emailChannel: NotificationChannel = {
  id: "email",

  async isConfigured(): Promise<boolean> {
    // sendEmail falls back through Cloudflare Email API and Resend in Node,
    // and the EMAIL binding in Workers — mirror that probe cheaply.
    const workersEmail = (globalThis as { __ENV__?: { EMAIL_BINDING?: unknown } })
      .__ENV__?.EMAIL_BINDING;
    return Boolean(workersEmail) || isCloudflareEmailConfigured() || isResendConfigured();
  },

  async sendBlock({
    target,
    blocks,
  }: {
    target: string;
    blocks: NotificationBlock[];
  }): Promise<{ messageId: string }> {
    const body = render(blocks);
    await sendEmail({
      to: target,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });
    // Email sends are fire-and-forget through the provider — synthesize a
    // stable id from the timestamp so `sendBlock` results remain comparable
    // to Slack's messageId in runtime logs.
    return { messageId: `email-${Date.now()}` };
  },

  async reply(): Promise<void> {
    // No thread model for email — the runtime calls reply() only for
    // event-level follow-ups; skip rather than spamming a second email.
  },
};
