import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";

const KC_BASE = process.env.KEYCLOAK_ISSUER ?? process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
const KC_REALM = KC_BASE ? (KC_BASE.split("/realms/")[1] ?? "master") : "master";
const KC_ADMIN = KC_BASE ? KC_BASE.replace(`/realms/${KC_REALM}`, "") : "";
const ADMIN_URL = `${KC_ADMIN}/admin/realms/${KC_REALM}`;

/**
 * Obtain a short-lived Keycloak admin token. Prefers a confidential
 * service-account client (client_credentials) whose creds live in SSM — on
 * Lambda/Pi they are NOT in process.env, which is why the env-only path 500'd.
 * Falls back to the resource-owner password grant only if no client secret is
 * configured (e.g. local dev with env vars).
 */
async function getAdminToken(): Promise<string> {
  const cfg = await getConfig().catch(() => null);
  const clientId =
    cfg?.KEYCLOAK_ADMIN_CLIENT_ID || process.env.KEYCLOAK_ADMIN_CLIENT_ID || "admin-cli";
  const clientSecret =
    cfg?.KEYCLOAK_ADMIN_CLIENT_SECRET || process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || "";
  const adminUser = cfg?.KEYCLOAK_ADMIN_USER || process.env.KEYCLOAK_ADMIN_USER || "";
  const adminPass = cfg?.KEYCLOAK_ADMIN_PASSWORD || process.env.KEYCLOAK_ADMIN_PASSWORD || "";

  // Prefer client-credentials, fall back to resource-owner password for admin-cli
  const body = clientSecret
    ? new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      })
    : new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        username: adminUser,
        password: adminPass,
      });

  const res = await globalThis.fetch(`${KC_BASE}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Keycloak admin token failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function kcFetch(path: string, token: string, init?: RequestInit) {
  return globalThis.fetch(`${ADMIN_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!KC_BASE) {
    return NextResponse.json({ error: "Keycloak not configured" }, { status: 503 });
  }

  try {
    const token = await getAdminToken();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 60);
    const filter = (searchParams.get("filter") ?? "").replace(/[^\w.@+-]/g, "").slice(0, 128);

    const qs = new URLSearchParams({ max: String(limit) });
    if (filter) qs.set("search", filter);

    const res = await kcFetch(`/users?${qs}`, token);
    if (!res.ok) throw new Error(`Keycloak list users: ${res.status}`);

    interface KcUser {
      id: string;
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      emailVerified?: boolean;
      enabled?: boolean;
      createdTimestamp?: number;
      attributes?: Record<string, string[]>;
    }
    const kcUsers = (await res.json()) as KcUser[];

    const users = await Promise.all(
      kcUsers.map(async (u) => {
        let isAdmin = false;
        try {
          const gr = await kcFetch(`/users/${u.id}/groups`, token);
          if (gr.ok) {
            const groups = (await gr.json()) as Array<{ name: string }>;
            isAdmin = groups.some((g) => g.name === "admin");
          }
        } catch {
          /* default non-admin */
        }

        const attrs = u.attributes ?? {};
        return {
          username: u.id,
          email: u.email ?? "",
          name: [u.firstName, u.lastName].filter(Boolean).join(" "),
          company: attrs["company"]?.[0] ?? "",
          phone: attrs["phone"]?.[0] ?? "",
          emailVerified: u.emailVerified ?? false,
          status: u.enabled ? "active" : "disabled",
          userStatus: u.enabled ? "CONFIRMED" : "DISABLED",
          role: isAdmin ? "admin" : "user",
          created: u.createdTimestamp ? new Date(u.createdTimestamp).toISOString() : undefined,
        };
      })
    );

    return NextResponse.json({ users, count: users.length });
  } catch (err) {
    console.error("Failed to list Keycloak users:", err);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!KC_BASE) {
    return NextResponse.json({ error: "Keycloak not configured" }, { status: 503 });
  }

  try {
    const token = await getAdminToken();
    const { action, username: userId } = (await request.json()) as {
      action: string;
      username: string;
    };

    if (!action || !userId) {
      return NextResponse.json({ error: "action and username required" }, { status: 400 });
    }

    if (action === "disable") {
      await kcFetch(`/users/${userId}`, token, {
        method: "PUT",
        body: JSON.stringify({ enabled: false }),
      });
      return NextResponse.json({ success: true, message: "User disabled" });
    }

    if (action === "enable") {
      await kcFetch(`/users/${userId}`, token, {
        method: "PUT",
        body: JSON.stringify({ enabled: true }),
      });
      return NextResponse.json({ success: true, message: "User enabled" });
    }

    // Get admin group id
    const grRes = await kcFetch(`/groups?search=admin`, token);
    if (!grRes.ok) throw new Error("Could not fetch groups");
    const groups = (await grRes.json()) as Array<{ id: string; name: string }>;
    const adminGroup = groups.find((g) => g.name === "admin");
    if (!adminGroup) throw new Error("admin group not found");

    if (action === "promote") {
      await kcFetch(`/users/${userId}/groups/${adminGroup.id}`, token, { method: "PUT" });
      return NextResponse.json({ success: true, message: "User promoted to admin" });
    }

    if (action === "demote") {
      await kcFetch(`/users/${userId}/groups/${adminGroup.id}`, token, { method: "DELETE" });
      return NextResponse.json({ success: true, message: "User removed from admin group" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Failed to modify Keycloak user:", err);
    return NextResponse.json({ error: "Failed to modify user" }, { status: 500 });
  }
}
