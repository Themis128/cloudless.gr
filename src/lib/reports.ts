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

// In-memory fallback store
let store: Report[] = [];

export async function listReports(): Promise<Report[]> {
  return store.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getReport(id: string): Promise<Report | null> {
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
  store.push(report);
  return report;
}

export async function updateReport(
  id: string,
  updates: Partial<Report>,
): Promise<Report | null> {
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store[idx] = { ...store[idx], ...updates };
  return store[idx];
}

export async function deleteReport(id: string): Promise<boolean> {
  const len = store.length;
  store = store.filter((r) => r.id !== id);
  return store.length < len;
}
