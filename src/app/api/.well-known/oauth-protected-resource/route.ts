import { NextResponse } from "next/server";

export async function GET() {
  const resource = {
    resource: "https://cloudless.gr",
    authorization_servers: ["https://cloudless.gr"],
    scopes_supported: ["openid", "profile", "email", "admin", "analytics.read", "calendar.write"],
  };

  return NextResponse.json(resource);
}
