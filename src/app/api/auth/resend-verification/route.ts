import { NextResponse } from "next/server";

// Email verification is handled by the Cognito Hosted UI.
// This endpoint is no longer in use.
export function POST() {
  return NextResponse.json({ error: "Not available" }, { status: 503 });
}
