/**
 * AppFlowy Calendar — shared types and helpers for calendar integration.
 *
 * AppFlowy doesn't have a native calendar database like Notion.
 * This module provides compatible types and empty implementations.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  tags?: string[];
}

export interface PostizGroup {
  id: string;
  name: string;
  platform: string;
}

/**
 * Get calendar events from AppFlowy.
 * Returns empty array since AppFlowy doesn't have calendar database.
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return [];
}

/**
 * Get Postiz groups from AppFlowy.
 * Returns empty array since AppFlowy doesn't have this concept.
 */
export async function getPostizGroups(): Promise<PostizGroup[]> {
  return [];
}

/**
 * Sync calendar events to external service.
 * No-op for AppFlowy.
 */
export async function syncCalendarEvents(): Promise<boolean> {
  console.log("[AppFlowy Calendar] syncCalendarEvents called (no-op)");
  return false;
}
