import { NextResponse } from "next/server";
import { ACP_VERSION, SITE_URL } from "@/lib/agentic-commerce";

/**
 * GET /.well-known/acp.json — Agentic Commerce Protocol discovery document
 * (rfc.discovery, agentic-commerce-protocol). Public, unauthenticated,
 * cacheable. Served via next.config.ts rewrite to this handler.
 */
export async function GET() {
  const doc = {
    protocol: {
      name: "acp",
      version: ACP_VERSION,
      supported_versions: [ACP_VERSION],
      documentation_url: "https://agenticcommerce.dev",
    },
    api_base_url: `${SITE_URL}/api/acp`,
    transports: ["rest"],
    capabilities: {
      services: ["checkout"],
      intervention_types: ["3ds"],
      supported_currencies: ["eur"],
      supported_locales: ["en-US", "el-GR", "fr-FR", "de-DE"],
    },
  };

  return NextResponse.json(doc, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
