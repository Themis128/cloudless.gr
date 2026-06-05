import { NextResponse } from "next/server";

// Registration is handled by the Cognito Hosted UI.
// This endpoint is no longer in use.
export function POST() {
  return NextResponse.json({ error: "Registration not available" }, { status: 503 });
}
