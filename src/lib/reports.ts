import { getIntegrationsAsync } from "@/lib/integrations";
import {
  notionListReports,
  notionGetReport,
  notionCreateReport,
  notionUpdateReport,
  notionDeleteReport,
} from "@/lib/notion-reports";

export interface ReportSection {
  id: string;
  title: string;
  data: Record<string, unknown>;
  insights?: string;
}

export interface Report {
  id: string;
  clientName: string;
  dateRange: { start: string; end: string };
  sections: ReportSection[];
  createdAt: string;
  status: "generating" | "ready" | "error";
}

export interface GenerateReportInput {
  clientName: string;
  dateStart: string;
  dateEnd: string;
  includeSections: string[];
}

// In-memory fallback store (used when Notion is not configured)
let store: Report[] = [];

async function notionEnabled(): Promise<boolean> {
  const cfg = await getIntegrationsAsync();
  return !!(cfg.NOTION_API_KEY && cfg.NOTION_REPORTS_DB_ID);
}

export async function listReports(): Promise<Report[]> {
  if (await notionEnabled()) {
    return (await notionListReports()) ?? [];
  }
  return store.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getReport(id: string): Promise<Report | null> {
  if (await notionEnabled()) {
    return notionGetReport(id);
  }
  return store.find((r) => r.id === id) ?? null;
}

export async function createReport(input: GenerateReportInput): Promise<Report> {
  const report: Report = {
    id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    clientName: input.clientName,
    dateRange: { start: input.dateStart, end: input.dateEnd },
    sections: [],
    createdAt: new Date().toISOString(),
    status: "generating",
  };
  if (await notionEnabled()) {
    await notionCreateReport(report);
  } else {
    store.push(report);
  }
  return report;
}

export async function updateReport(
  id: string,
  updates: Partial<Report>,
): Promise<Report | null> {
  if (await notionEnabled()) {
    const ok = await notionUpdateReport(id, updates);
    if (!ok) return null;
    return notionGetReport(id);
  }
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export async function deleteReport(id: string): Promise<boolean> {
  if (await notionEnabled()) {
    return notionDeleteReport(id);
  }
  const len = store.length;
  store = store.filter((r) => r.id !== id);
  return store.length < len;
}
