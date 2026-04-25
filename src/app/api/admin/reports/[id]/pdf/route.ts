import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getReport } from "@/lib/reports";
import { escapeHtml } from "@/lib/escape-html";

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "N/A";
  if (typeof val === "number") return val.toLocaleString("en-IE");
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return escapeHtml(String(val));
}

function renderSection(section: {
  title: string;
  data: Record<string, unknown>;
  insights?: string;
}): string {
  const rows = Object.entries(section.data)
    .map(
      ([k, v]) =>
        `<tr><td class="key">${escapeHtml(k.replace(/_/g, " "))}</td><td class="val">${formatValue(v)}</td></tr>`,
    )
    .join("");

  return `
    <section class="section">
      <h2>${escapeHtml(section.title)}</h2>
      ${rows ? `<table><tbody>${rows}</tbody></table>` : ""}
      ${section.insights ? `<div class="insights"><h3>AI Insights</h3><p>${escapeHtml(section.insights)}</p></div>` : ""}
    </section>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const sectionsHtml = report.sections.map(renderSection).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.clientName)} — Performance Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 13px; }
    header { border-bottom: 3px solid #00d4ff; padding-bottom: 20px; margin-bottom: 32px; }
    header h1 { font-size: 26px; font-weight: 700; color: #1a1a2e; }
    header .meta { margin-top: 8px; color: #555; font-size: 12px; }
    header .meta span { margin-right: 24px; }
    .section { margin-bottom: 36px; page-break-inside: avoid; }
    .section h2 { font-size: 16px; font-weight: 600; color: #00d4ff; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    td.key { color: #64748b; text-transform: capitalize; width: 40%; font-weight: 500; }
    td.val { color: #1a1a2e; font-weight: 600; }
    .insights { background: #f8fafc; border-left: 3px solid #00d4ff; padding: 12px 16px; border-radius: 4px; margin-top: 10px; }
    .insights h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .insights p { color: #374151; line-height: 1.6; }
    footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 14px; color: #94a3b8; font-size: 11px; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.clientName)} — Performance Report</h1>
    <div class="meta">
      <span>Period: ${escapeHtml(report.dateRange.start)} to ${escapeHtml(report.dateRange.end)}</span>
      <span>Generated: ${new Date(report.createdAt).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })}</span>
      <span>Status: ${escapeHtml(report.status)}</span>
    </div>
  </header>

  ${sectionsHtml || "<p style='color:#64748b'>No sections available.</p>"}

  <footer>
    <span>Cloudless.gr — Digital Agency</span>
    <span>Report ID: ${escapeHtml(id)}</span>
  </footer>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="report-${id}.html"`,
    },
  });
}
