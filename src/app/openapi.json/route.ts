import { NextResponse } from "next/server";
import { authOpenApiSpec } from "@/lib/auth-openapi";

/**
 * GET /openapi.json — the site-wide OpenAPI document at the conventional
 * location (scanners and API clients probe this path). Extends the auth spec
 * with the agentic-commerce surface added on feat/agentic-commerce-discovery.
 */
export async function GET() {
  const spec = {
    ...authOpenApiSpec,
    info: {
      ...authOpenApiSpec.info,
      title: "Cloudless.gr API",
      description:
        "Authentication, agentic-commerce (ACP/UCP), and discovery endpoints for cloudless.gr.",
    },
    paths: {
      ...authOpenApiSpec.paths,
      "/.well-known/acp.json": {
        get: {
          summary: "ACP discovery document",
          operationId: "acpDiscovery",
          responses: { "200": { description: "ACP rfc.discovery profile" } },
        },
      },
      "/.well-known/ucp": {
        get: {
          summary: "UCP business profile",
          operationId: "ucpProfile",
          responses: { "200": { description: "UCP 2026-04-08 business profile" } },
        },
      },
      "/api/acp/checkout_sessions": {
        post: {
          summary: "Create an ACP checkout session",
          description:
            "Creates a Stripe-backed checkout session; payment completes on the hosted Stripe page via continue_url.",
          operationId: "acpCreateCheckoutSession",
          responses: {
            "201": { description: "Checkout session created" },
            "400": { description: "Invalid request" },
          },
        },
      },
      "/api/ucp/catalog/search": {
        post: {
          summary: "Search the product catalog (UCP)",
          operationId: "ucpCatalogSearch",
          responses: { "200": { description: "Matching products" } },
        },
      },
      "/api/ucp/checkout-sessions": {
        post: {
          summary: "Create a UCP checkout session",
          operationId: "ucpCreateCheckout",
          responses: {
            "201": { description: "Checkout session created" },
            "400": { description: "Invalid request" },
          },
        },
      },
    },
  };
  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
