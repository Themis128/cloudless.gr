import { NextResponse } from "next/server";
import {
  SITE_URL,
  UCP_VERSION,
  UCP_SPEC,
  UCP_REST_SCHEMA,
  UCP_CAPABILITIES,
} from "@/lib/agentic-commerce";

/**
 * GET /.well-known/ucp — UCP business discovery profile (spec 2026-04-08).
 * Declares the shopping service endpoint and the checkout capability actually
 * implemented at /api/ucp. Payment completes on the Stripe-hosted checkout
 * page — no delegated payment handlers are declared because none are
 * accepted. Served via next.config.ts rewrite.
 */
export async function GET() {
  const profile = {
    ucp: {
      version: UCP_VERSION,
      services: {
        "dev.ucp.shopping": [
          {
            version: UCP_VERSION,
            spec: UCP_SPEC,
            transport: "rest",
            endpoint: `${SITE_URL}/api/ucp`,
            schema: UCP_REST_SCHEMA,
          },
        ],
      },
      capabilities: UCP_CAPABILITIES,
      payment_handlers: {},
    },
  };

  return NextResponse.json(profile, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
