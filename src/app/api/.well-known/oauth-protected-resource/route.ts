import { NextResponse } from "next/server";

export async function GET() {
  const resource = {
    resource: "https://cloudless.gr",
    authorization_servers: ["https://cloudless.gr"],
    scopes_supported: ["openid", "profile", "email", "admin", "analytics.read", "calendar.write"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://cloudless.gr/docs",
  };

  return NextResponse.json(resource);
}
