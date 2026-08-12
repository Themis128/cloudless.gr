/**
 * AppFlowy Reports — placeholder for reports functionality.
 *
 * AppFlowy doesn't have native reports database.
 * This module provides compatible empty implementations.
 */

export interface Report {
  id: string;
  title: string;
  type: string;
  status: "draft" | "published" | "archived";
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get reports from AppFlowy.
 * Returns empty array.
 */
export async function getReports(): Promise<Report[]> {
  return [];
}

/**
 * Get a single report by ID.
 * Returns null.
 */
export async function getReport(id: string): Promise<Report | null> {
  return null;
}

/**
 * Create a report in AppFlowy.
 * No-op.
 */
export async function createReport(
  data: Omit<Report, "id" | "createdAt" | "updatedAt">
): Promise<string | null> {
  console.log("[AppFlowy Reports] Would create report:", data.title);
  return null;
}

/**
 * Update a report in AppFlowy.
 * No-op.
 */
export async function updateReport(id: string, data: Partial<Report>): Promise<boolean> {
  console.log("[AppFlowy Reports] Would update report:", id);
  return false;
}

/**
 * Delete a report in AppFlowy.
 * No-op.
 */
export async function deleteReport(id: string): Promise<boolean> {
  console.log("[AppFlowy Reports] Would delete report:", id);
  return false;
}
