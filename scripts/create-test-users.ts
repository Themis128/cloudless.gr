#!/usr/bin/env tsx
/**
 * Create (or update) the two test accounts used by the e2e suite against
 * the Keycloak `cloudless` realm:
 *
 *   - a TEST ADMIN  → granted the realm role `admin` (full /admin access)
 *   - a TEST USER   → no privileged role (only /dashboard + /portal)
 *
 * The access model these two accounts exercise is documented in
 * docs/test-accounts.md. In short: middleware + auth-guard gate /admin
 * behind the `admin` realm role; everything else under /dashboard and
 * /portal only needs a valid session.
 *
 * Usage:
 *   pnpm test-users:create                 # create / update both accounts
 *   pnpm test-users:create --dry-run       # preview, no writes
 *   pnpm test-users:create --admin-only    # only the admin account
 *   pnpm test-users:create --user-only     # only the plain user account
 *
 * Required env (Keycloak admin API — falls back from SSM to these):
 *   KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD
 *   (optional) KEYCLOAK_URL   default https://auth.cloudless.gr
 *   (optional) KEYCLOAK_REALM default cloudless
 *
 * Test-account env (emails default; passwords auto-generated if unset):
 *   E2E_ADMIN_EMAIL    default test-admin@cloudless.gr
 *   E2E_ADMIN_PASSWORD generated + printed if unset
 *   E2E_USER_EMAIL     default test-user@cloudless.gr
 *   E2E_USER_PASSWORD  generated + printed if unset
 *
 * After running, feed the printed credentials back as env vars (ideally
 * session secrets) and drive the login with:
 *   E2E_BASE_URL=https://cloudless.gr pnpm e2e:prod
 */
import { randomBytes } from "node:crypto";
import { createUser } from "../src/lib/keycloak-admin";

type Spec = {
  label: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  realmRoles: string[];
};

/** A reasonably strong, URL-safe password for an unattended test account. */
function generatePassword(): string {
  return `Tt-${randomBytes(18).toString("base64url")}`;
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function buildSpecs(): { admin: Spec; user: Spec } {
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || generatePassword();
  const userPassword = process.env.E2E_USER_PASSWORD || generatePassword();
  return {
    admin: {
      label: "TEST ADMIN",
      email: envOr("E2E_ADMIN_EMAIL", "test-admin@cloudless.gr"),
      password: adminPassword,
      firstName: "Test",
      lastName: "Admin",
      realmRoles: ["admin"],
    },
    user: {
      label: "TEST USER",
      email: envOr("E2E_USER_EMAIL", "test-user@cloudless.gr"),
      password: userPassword,
      firstName: "Test",
      lastName: "User",
      realmRoles: [], // plain authenticated user — no privileged role
    },
  };
}

function assertAdminCredentials() {
  const missing = ["KEYCLOAK_ADMIN_USER", "KEYCLOAK_ADMIN_PASSWORD"].filter(
    (k) => !process.env[k]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing Keycloak admin credentials: ${missing.join(", ")}. ` +
        `Set them as env vars (or session secrets) before running. ` +
        `On Lambda/Pi they come from SSM; locally/in CI use env vars.`,
    );
  }
}

async function provision(spec: Spec, dryRun: boolean): Promise<void> {
  const roleSummary = spec.realmRoles.length
    ? `roles=[${spec.realmRoles.join(", ")}]`
    : "roles=[] (plain user)";
  if (dryRun) {
    console.log(`  [dry-run] would upsert ${spec.label}: ${spec.email}  ${roleSummary}`);
    return;
  }
  const id = await createUser({
    email: spec.email,
    password: spec.password,
    firstName: spec.firstName,
    lastName: spec.lastName,
    emailVerified: true,
    enabled: true,
    realmRoles: spec.realmRoles,
  });
  console.log(`  ✓ ${spec.label}: ${spec.email}  id=${id}  ${roleSummary}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const adminOnly = args.has("--admin-only");
  const userOnly = args.has("--user-only");

  if (!dryRun) assertAdminCredentials();

  const { admin, user } = buildSpecs();
  const targets: Spec[] = [];
  if (!userOnly) targets.push(admin);
  if (!adminOnly) targets.push(user);

  const realm = envOr("KEYCLOAK_REALM", "cloudless");
  const url = envOr("KEYCLOAK_URL", "https://auth.cloudless.gr");
  console.log(`Provisioning test accounts in realm "${realm}" at ${url}${dryRun ? " (dry-run)" : ""}`);

  for (const spec of targets) {
    await provision(spec, dryRun);
  }

  if (!dryRun) {
    console.log("\nCredentials (capture these as env vars / session secrets):");
    if (!userOnly) {
      console.log(`  E2E_ADMIN_EMAIL=${admin.email}`);
      console.log(`  E2E_ADMIN_PASSWORD=${admin.password}`);
    }
    if (!adminOnly) {
      console.log(`  E2E_USER_EMAIL=${user.email}`);
      console.log(`  E2E_USER_PASSWORD=${user.password}`);
    }
    console.log("\nThen test the login flow against production:");
    console.log("  E2E_BASE_URL=https://cloudless.gr pnpm e2e:prod");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
