import { NextRequest, NextResponse } from "next/server";
import { sendActivationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-resend:ip:${getClientIp(req)}`, 5, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  try {
    const body = (await req.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!email) return NextResponse.json({ ok: true });

  // Generate a fresh token + OTP using Web Crypto
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    new TextEncoder().encode(`${email}:${exp}:${nonce}`)
  );
  const sigBytes = new Uint8Array(sigBuffer);
  const sigB64 = btoa(String.fromCharCode(...sigBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const token = `${nonce}.${exp}.${sigB64}`;

  const otpBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    new TextEncoder().encode(`otp:${email}:${exp}:${nonce}`)
  );
  const otpHex = Array.from(new Uint8Array(otpBuffer))
    .map((b) => "00".concat(b.toString(16)).slice(-2))
    .join("");
  const otp = (parseInt(otpHex.slice(0, 8), 16) % 1_000_000).toString().padStart(6, "0");

  sendActivationEmail(email, token, otp).catch(() => {});

  return NextResponse.json({ ok: true, token });
}