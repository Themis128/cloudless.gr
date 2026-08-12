/**
 * AppFlowy ESP32 Sync — placeholder for ESP32 device synchronization.
 *
 * AppFlowy doesn't have native ESP32 integration.
 * This module provides a compatible no-op interface.
 */

export interface ESP32Device {
  id: string;
  name: string;
  status: "online" | "offline" | "error";
  lastSeen: string;
  sensors: Record<string, unknown>;
}

export interface ESP32Alert {
  id: string;
  deviceId: string;
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  acknowledged: boolean;
}

/**
 * Sync ESP32 device data from AppFlowy.
 * Returns empty array since AppFlowy doesn't have ESP32 integration.
 */
export async function syncESP32Devices(): Promise<ESP32Device[]> {
  return [];
}

/**
 * Get ESP32 alerts from AppFlowy.
 * Returns empty array.
 */
export async function getESP32Alerts(): Promise<ESP32Alert[]> {
  return [];
}

/**
 * Acknowledge an ESP32 alert.
 * No-op for AppFlowy.
 */
export async function acknowledgeESP32Alert(alertId: string): Promise<boolean> {
  console.log("[AppFlowy ESP32] acknowledgeESP32Alert called for", alertId, "(no-op)");
  return false;
}

/**
 * Create an alert in AppFlowy for an ESP32 device.
 * No-op for AppFlowy.
 */
export async function createESP32Alert(
  alert: Omit<ESP32Alert, "id" | "acknowledged" | "timestamp">
): Promise<string | null> {
  console.log("[AppFlowy ESP32] Would create alert:", alert);
  return null;
}
