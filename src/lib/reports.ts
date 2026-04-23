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

let store: Report[] = [];

export function listReports(): Report[] {
  return store.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getReport(id: string): Report | null {
  return store.find((r) => r.id === id) ?? null;
}

export function createReport(input: GenerateReportInput): Report {
  const report: Report = {
    id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    clientName: input.clientName,
    dateRange: { start: input.dateStart, end: input.dateEnd },
    sections: [],
    createdAt: new Date().toISOString(),
    status: "generating",
  };
  store.push(report);
  return report;
}

export function updateReport(id: string, updates: Partial<Report>): Report | null {
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export function deleteReport(id: string): boolean {
  const len = store.length;
  store = store.filter((r) => r.id !== id);
  return store.length < len;
}
