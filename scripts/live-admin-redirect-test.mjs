#!/usr/bin/env node
/**
 * Live end-to-end test of the post-login admin redirect against production.
 *
 * Mints a real next-auth session cookie (groups:["admin"]) signed with the
 * production AUTH_SECRET, then hits the LIVE middleware at
 * https://cloudless.gr/en/auth/post-login and asserts it 307s to /en/admin.
 * Exercises BOTH the unchunked cookie and the chunked form (the bug from
 * #419) so we prove the deployed middleware reassembles chunks and routes
 * admins to /admin.
 *
 * AUTH_SECRET is read from env (supplied by the workflow from SSM) and never
 * printed. No browser, no real password — the cookie is forged with the same
 * secret the server uses to decode it, which is exactly what a real login
 * produces.
 *
 * Env:
 *   AUTH_SECRET  (required)  production next-auth secret
 *   BASE         (optional)  default https://cloudless.gr
 */
import { encode } from "@auth/core/jwt";

const BASE = process.env.BASE ?? "https://cloudless.gr";
const COOKIE = "__Secure-authjs.session-token"; // production cookie name
const secret = process.env.AUTH_SECRET;
if (!secret) {
  console.error("AUTH_SECRET missing");
  process.exit(2);
}

const token = {
  sub: "live-admin-redirect-test",
  name: "Live Admin Test",
  email: "tbaltzakis@cloudless.gr",
  groups: ["admin"],
  roles: [],
};

// salt MUST equal the cookie name — getToken on the server decodes with
// salt = cookieName, so encode has to match or decryption fails.
const jwt = await encode({ token, secret, salt: COOKIE, maxAge: 600 });

function locationOf(res) {
  return res.headers.get("location") ?? "(none)";
}

async function probe(label, cookieHeader) {
  const res = await fetch(`${BASE}/en/auth/post-login`, {
    headers: { cookie: cookieHeader },
    redirect: "manual",
  });
  const loc = locationOf(res);
  const ok = res.status >= 300 && res.status < 400 && /\/en\/admin$/.test(loc);
  console.log(`${label}: HTTP ${res.status} -> ${loc}  ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

// 1) Unchunked cookie
const whole = `${COOKIE}=${jwt}`;
// 2) Chunked cookie — split the JWT; next-auth's SessionStore concatenates
//    <name>.0 + <name>.1 (ordered) back into the whole value.
const mid = Math.ceil(jwt.length / 2);
const chunked = `${COOKIE}.0=${jwt.slice(0, mid)}; ${COOKIE}.1=${jwt.slice(mid)}`;

console.log(`BASE=${BASE} jwt_len=${jwt.length}`);
const r1 = await probe("unchunked", whole);
const r2 = await probe("chunked  ", chunked);

// Sanity: a logged-out request must NOT go to /admin (guards a false PASS).
const resOut = await fetch(`${BASE}/en/auth/post-login`, { redirect: "manual" });
const outLoc = locationOf(resOut);
const outOk = /\/en\/auth\/login$/.test(outLoc);
console.log(`no-cookie : HTTP ${resOut.status} -> ${outLoc}  ${outOk ? "PASS (login)" : "FAIL"}`);

const allOk = r1 && r2 && outOk;
console.log(`RESULT=${allOk ? "PASS" : "FAIL"} (admin redirect to /admin live)`);
process.exit(allOk ? 0 : 1);
