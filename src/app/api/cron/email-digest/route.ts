/**
 * GET /api/cron/email-digest
 * Weekly executive email digest — executive AI insight + 4 KPIs from the datalake.
 * Requires: Authorization: Bearer <CRON_SECRET>
 * Schedule via Cloudflare Workers Cron: 0 8 * * 1  (every Monday 08:00 UTC)
 */
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { getInsight } from "@/lib/datalake-serve";
import { sendEmail, SENDERS } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) return cronUnauthorized();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cloudless.gr";
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL ?? "baltzakis.themis@gmail.com";

  const [executive, revenue, seo, crm] = await Promise.all([
    getInsight("executive").catch(() => null),
    getInsight("revenue").catch(() => null),
    getInsight("seo").catch(() => null),
    getInsight("crm_funnel").catch(() => null),
  ]);

  const now = new Date();
  const weekLabel = now.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  });

  const kpiBlock = (
    label: string,
    insight: Awaited<ReturnType<typeof getInsight>>,
    color: string
  ) => {
    if (!insight || insight.error) return "";
    const top = insight.bullets[0] ?? insight.summary.slice(0, 120);
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #1e2030">
          <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${color};margin-bottom:4px">${escapeHtml(label)}</div>
          <div style="font-size:13px;color:#c9d1d9;line-height:1.5">${escapeHtml(top)}</div>
        </td>
      </tr>`;
  };

  const execSummary =
    executive?.summary ??
    "No executive insight available yet — run the analytics orchestration job to generate one.";
  const execBullets = (executive?.bullets ?? [])
    .map((b) => `<li style="margin-bottom:6px;color:#8b949e;font-size:13px">${escapeHtml(b)}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <div style="margin-bottom:24px">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#3fb950;margin-bottom:8px">Weekly Digest</div>
      <h1 style="font-size:22px;font-weight:700;color:#e6edf3;margin:0 0 4px">cloudless.gr</h1>
      <p style="font-size:13px;color:#8b949e;margin:0">${escapeHtml(weekLabel)}</p>
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:20px">
      <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#3fb950;margin-bottom:10px">Executive Summary</div>
      <p style="font-size:14px;color:#e6edf3;line-height:1.6;margin:0 0 12px">${escapeHtml(execSummary)}</p>
      ${execBullets ? `<ul style="padding-left:18px;margin:0">${execBullets}</ul>` : ""}
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <div style="padding:12px 16px;border-bottom:1px solid #21262d">
        <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#8b949e">Domain Highlights</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>
          ${kpiBlock("Revenue", revenue, "#3fb950")}
          ${kpiBlock("SEO", seo, "#58a6ff")}
          ${kpiBlock("CRM Funnel", crm, "#f78166")}
        </tbody>
      </table>
    </div>

    <div style="text-align:center;margin-top:24px">
      <a href="${siteUrl}/admin/analytics/unified" style="display:inline-block;padding:10px 24px;background:#238636;color:#ffffff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
        Open Dashboard →
      </a>
    </div>

    <p style="margin-top:24px;font-size:11px;color:#484f58;text-align:center">
      cloudless.gr · <a href="${siteUrl}/admin" style="color:#484f58">Admin</a>
    </p>
  </div>
</body>
</html>`;

  const text = [
    `cloudless.gr — Weekly Digest (${weekLabel})`,
    "",
    "EXECUTIVE SUMMARY",
    execSummary,
    ...(executive?.bullets ?? []).map((b) => `• ${b}`),
    "",
    revenue?.bullets[0] ? `REVENUE: ${revenue.bullets[0]}` : "",
    seo?.bullets[0] ? `SEO: ${seo.bullets[0]}` : "",
    crm?.bullets[0] ? `CRM: ${crm.bullets[0]}` : "",
    "",
    `Dashboard: ${siteUrl}/admin/analytics/unified`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  try {
    await sendEmail({
      to: recipient,
      from: SENDERS.admin,
      fromLabel: "cloudless.gr",
      subject: `Weekly Digest — ${weekLabel}`,
      html,
      text,
    });

    return NextResponse.json({
      ok: true,
      recipient,
      domains: ["executive", "revenue", "seo", "crm_funnel"],
      sentAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[email-digest] send failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
