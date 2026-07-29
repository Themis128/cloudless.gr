import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
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

  // Generate a fresh token + OTP
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const exp = Date.now() + 5 * 60 * 1000; // 5-minute window
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
  const token = `${nonce}.${exp}.${sig}`;
  const _otp = (
    parseInt(
      createHmac("sha256", secret).update(`otp:${email}:${exp}:${nonce}`).digest("hex").slice(0, 8),
      16
    ) % 1_000_000
  )
    .toString()
    .padStart(6, "0");

  // Send our branded SES email with the new token+OTP, fire-and-forget
  sendActivationEmail(email, token).catch(() => {});

  // Return the new token so the client can verify the fresh OTP
  return NextResponse.json({ ok: true, token });
}
