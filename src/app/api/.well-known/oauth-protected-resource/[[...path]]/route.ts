import { NextResponse } from "next/server";

// RFC 9728 Protected Resource Metadata. Served at both the bare well-known URI
// and path-suffixed forms (/.well-known/oauth-protected-resource/{path}), per
// §3.1 — the resource identifier follows the requested path so each protected
// resource resolves to metadata describing itself.
export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const suffix = path?.length ? `/${path.join("/")}` : "";

  return NextResponse.json({
    resource: `https://cloudless.gr${suffix}`,
    authorization_servers: ["https://cloudless.gr"],
    scopes_supported: ["openid", "profile", "email", "admin", "analytics.read", "calendar.write"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://cloudless.gr/docs",
  });
}
