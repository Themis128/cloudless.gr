import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ProfileBody {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

type KcAttributes = Record<string, string[]>;
interface KcAccount {
  firstName?: string;
  lastName?: string;
  email?: string;
  attributes?: KcAttributes;
}

function splitName(name: string): { firstName: string; lastName?: string } {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { firstName: first ?? "", lastName: rest.length ? rest.join(" ") : undefined };
}

/**
 * POST /api/user/profile
 *
 * Updates the signed-in user's Keycloak profile (name + company/phone
 * attributes, and optional preferences). This MUST run server-side: the
 * browser cannot call Keycloak's Account REST API directly because that is a
 * cross-origin request (cloudless.gr → auth.cloudless.gr) which Keycloak does
 * not send CORS headers for — the browser blocks it and the client sees the
 * opaque "Failed to fetch". Server→Keycloak has no CORS constraint, and the
 * user's access_token (aud: account) is accepted by the Account API.
 */
export async function POST(req: Request) {
  const session = await auth();
  const accessToken = session?.accessToken;
  if (!session?.user || !accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const KC_ISSUER = process.env.KEYCLOAK_ISSUER ?? process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
  if (!KC_ISSUER) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountUrl = `${KC_ISSUER}/account`;
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // Read the current account FIRST so we merge (not clobber) existing fields.
  // The Account API POST is a full update — omitting email/attributes can blank
  // them — so if we can't read the current state we must NOT write.
  let current: KcAccount;
  try {
    const res = await globalThis.fetch(accountUrl, {
      headers: { ...authHeader, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not read current profile", status: res.status },
        { status: 502 }
      );
    }
    current = (await res.json()) as KcAccount;
  } catch {
    return NextResponse.json({ error: "Could not reach auth server" }, { status: 502 });
  }

  // Never blank the email: it is read-only in the UI, so always preserve it
  // (fall back to the session's email if the account representation omits it).
  const preservedEmail = current.email ?? session.user.email ?? undefined;

  const attributes: KcAttributes = { ...(current.attributes ?? {}) };
  if (body.company !== undefined) attributes.company = [body.company];
  if (body.phone !== undefined && body.phone !== "") attributes.phone = [body.phone];
  else if (body.phone === "") delete attributes.phone;
  if (body.preferences !== undefined) {
    attributes.preferences = [JSON.stringify(body.preferences)];
  }

  const payload: KcAccount = {
    firstName: current.firstName,
    lastName: current.lastName,
    email: preservedEmail,
    attributes,
  };
  if (body.name) {
    const { firstName, lastName } = splitName(body.name);
    payload.firstName = firstName;
    payload.lastName = lastName;
  }

  try {
    const res = await globalThis.fetch(accountUrl, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      return NextResponse.json({ ok: true });
    }
    // Surface Keycloak's validation message (e.g. an attribute not allowed by
    // the realm user profile) instead of an opaque failure.
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to update profile", status: res.status, detail: detail.slice(0, 500) },
      { status: res.status === 400 ? 400 : 502 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to reach auth server" }, { status: 502 });
  }
}
