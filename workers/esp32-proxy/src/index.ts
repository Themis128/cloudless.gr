/**
 * Cloudflare Worker: ESP32 proxy
 *
 * Routes:
 *   GET  /api/esp32/devices              → Pi alert-API /api/esp32/status (wrapped as array)
 *   GET  /api/esp32/config?device_id=X   → Pi /api/esp32/{device_id}/config
 *   POST /api/esp32/command?device_id=X  → Pi /api/esp32/{device_id}/command
 *   POST /api/esp32/ota                  → Pi /api/esp32/ota
 *   PUT  /api/esp32/config?device_id=X   → Pi /api/esp32/{device_id}/config
 *
 * Auth: Bearer token in Authorization header (ADMIN_TOKEN secret).
 * CORS: restricted to ALLOWED_ORIGIN var.
 */

export interface Env {
  ALERT_API_URL: string;
  ALLOWED_ORIGIN: string;
  ADMIN_TOKEN: string;
}

const TIMEOUT_MS = 8_000;

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function unauthorized(origin: string): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function json(data: unknown, status = 200, origin = "*"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

async function proxyRequest(
  alertApiUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${alertApiUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (res.status === 404) {
      return { error: "ESP32 management unavailable", offline: true, _status: 503 };
    }
    const data = await res.json();
    return { ...(data as object), _status: res.status };
  } catch {
    return { error: "Pi unreachable", offline: true, _status: 503 };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN ?? "*";
    const url = new URL(request.url);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    // Auth — skip for local dev when ADMIN_TOKEN is not set
    if (env.ADMIN_TOKEN) {
      const authHeader = request.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== env.ADMIN_TOKEN) return unauthorized(origin);
    }

    const path = url.pathname; // e.g. /api/esp32/devices
    const deviceId = url.searchParams.get("device_id") ?? "esp32-leds";
    const alertApi = env.ALERT_API_URL;

    // ── GET /api/esp32/devices ────────────────────────────────────────────────
    if (request.method === "GET" && path === "/api/esp32/devices") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${alertApi}/api/esp32/status`, { signal: controller.signal });
        if (!res.ok) return json({ error: "No ESP32 devices found" }, 404, origin);
        const raw = (await res.json()) as Record<string, unknown>;
        const device = {
          device_id: raw.id != null ? `esp32-${raw.id}` : "esp32-leds",
          ip: raw.ip,
          rssi: raw.rssi,
          firmware_ver: raw.firmware_ver,
          uptime_s: raw.uptime_s,
          free_ram_bytes: raw.free_ram_bytes,
          last_heartbeat: raw.last_heartbeat,
          stale: raw.stale ?? true,
        };
        return json([device], 200, origin);
      } catch {
        return json({ error: "Pi unreachable", offline: true }, 503, origin);
      } finally {
        clearTimeout(timer);
      }
    }

    // ── GET /api/esp32/config ─────────────────────────────────────────────────
    if (request.method === "GET" && path === "/api/esp32/config") {
      const result = await proxyRequest(alertApi, `/api/esp32/${deviceId}/config`);
      const { _status, ...data } = result as Record<string, unknown>;
      return json(data, (_status as number) ?? 200, origin);
    }

    // ── POST /api/esp32/command ───────────────────────────────────────────────
    if (request.method === "POST" && path === "/api/esp32/command") {
      const body = await request.text();
      const result = await proxyRequest(alertApi, `/api/esp32/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const { _status, ...data } = result as Record<string, unknown>;
      return json(data, (_status as number) ?? 200, origin);
    }

    // ── POST /api/esp32/ota ───────────────────────────────────────────────────
    if (request.method === "POST" && path === "/api/esp32/ota") {
      const body = await request.text();
      const result = await proxyRequest(alertApi, `/api/esp32/ota`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const { _status, ...data } = result as Record<string, unknown>;
      return json(data, (_status as number) ?? 200, origin);
    }

    // ── PUT /api/esp32/config ─────────────────────────────────────────────────
    if (request.method === "PUT" && path === "/api/esp32/config") {
      const body = await request.text();
      const result = await proxyRequest(alertApi, `/api/esp32/${deviceId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const { _status, ...data } = result as Record<string, unknown>;
      return json(data, (_status as number) ?? 200, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};
