import { NextRequest } from "next/server";
import { renderAnalyticsReportPdf } from "@/lib/analytics-report-pdf";
import { prepareOrchestration } from "../_shared";

export async function POST(request: NextRequest) {
  const prepared = await prepareOrchestration(request, "Analytics PDF export failed.");
  if (!prepared.ok) return prepared.response;

  const { snapshot, orchestration, reportTitle } = prepared.data;
  const pdf = await renderAnalyticsReportPdf({
    reportTitle,
    result: orchestration,
  });

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="analytics-report-${snapshot.generatedAt.slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
