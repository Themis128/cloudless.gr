import { NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAdminToken, parseRealm, sendVerifyEmail } from "@/lib/keycloak-admin";

interface RegisterBody {
  email: string;
  password: string;
  fullName?: string;
}

const UNAVAILABLE = NextResponse.json({ error: "Registration not available" }, { status: 503 });

/** Validate the request body; returns an error response, or null when valid. */
function validateBody(body: RegisterBody): NextResponse | null {
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  // Reject malformed emails before they reach the Keycloak Admin API — prevents
  // garbage usernames and stops unvalidated input from driving send-verify-email.
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  return null;
}

/** Build the Keycloak user representation from the validated body. */
function buildUserRep(body: RegisterBody): Record<string, unknown> {
  const parts = (body.fullName ?? "").trim().split(" ").filter(Boolean);
  const rep: Record<string, unknown> = {
    email: body.email,
    username: body.email,
    enabled: true,
    emailVerified: false,
    requiredActions: ["VERIFY_EMAIL"],
    credentials: [{ type: "password", value: body.password, temporary: false }],
  };
  if (parts[0]) rep.firstName = parts[0];
  if (parts.length > 1) rep.lastName = parts.slice(1).join(" ");
  return rep;
}

export async function POST(req: Request) {
  const rl = rateLimit(`register:${getClientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) return UNAVAILABLE;

  // issuer = https://auth.cloudless.gr/realms/master
  const parsed = parseRealm(issuer);
  if (!parsed) return UNAVAILABLE;
  const { kcBase, realm } = parsed;

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const invalid = validateBody(body);
  if (invalid) return invalid;

  const config = await getConfig();
  if (!config.KEYCLOAK_ADMIN_CLIENT_ID || !config.KEYCLOAK_ADMIN_CLIENT_SECRET) {
    return UNAVAILABLE;
  }

  try {
    const adminToken = await getAdminToken(
      `${issuer}/protocol/openid-connect/token`,
      config.KEYCLOAK_ADMIN_CLIENT_ID,
      config.KEYCLOAK_ADMIN_CLIENT_SECRET
    );

    const createRes = await globalThis.fetch(`${kcBase}/admin/realms/${realm}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildUserRep(body)),
      signal: AbortSignal.timeout(10_000),
    });

    if (createRes.status === 409) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    if (!createRes.ok) {
      return NextResponse.json({ error: "Registration failed" }, { status: 400 });
    }

    // Send verification email via the app client so the link returns to
    // cloudless.gr. Best-effort: if SMTP is not yet configured the email
    // silently fails; the VERIFY_EMAIL required action still blocks sign-in
    // until the user verifies (recoverable via /api/auth/resend-verification).
    const userId = createRes.headers.get("Location")?.split("/").pop();
    if (userId) {
      await sendVerifyEmail(kcBase, realm, adminToken, userId).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/register]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
