import { NextResponse } from "next/server";

/**
 * GET /.well-known/ai-catalog.json (via the /api/.well-known/ rewrite).
 *
 * ARD (Agentic Resource Discovery) capability manifest per
 * agenticresourcediscovery.org + the ai-catalog data model. Lists only
 * surfaces that exist — entries point agents at the real API catalog,
 * docs index, chat endpoint, consultation booking, and published skills.
 */
export async function GET() {
  const manifest = {
    specVersion: "1.0",
    host: {
      displayName: "Cloudless",
      identifier: "did:web:cloudless.gr",
    },
    entries: [
      {
        identifier: "urn:air:cloudless.gr:catalog:api",
        displayName: "Cloudless API catalog",
        type: "application/linkset+json",
        url: "https://cloudless.gr/.well-known/api-catalog",
        representativeQueries: [
          "list the public APIs on cloudless.gr",
          "find the docs index endpoint",
          "where is the chat API described",
        ],
      },
      {
        identifier: "urn:air:cloudless.gr:api:docs",
        displayName: "Documentation index",
        type: "application/json",
        url: "https://cloudless.gr/api/docs",
        representativeQueries: [
          "list Cloudless documentation pages",
          "find docs about the chat API",
        ],
      },
      {
        identifier: "urn:air:cloudless.gr:api:chat",
        displayName: "Cloudless assistant chat",
        type: "application/json",
        url: "https://cloudless.gr/api/chat",
        representativeQueries: [
          "ask Cloudless about serverless migration",
          "what AI automation services do you offer",
          "how much does a cloud migration cost",
        ],
      },
      {
        identifier: "urn:air:cloudless.gr:api:calendar",
        displayName: "Consultation booking",
        type: "application/json",
        url: "https://cloudless.gr/api/calendar/availability",
        representativeQueries: [
          "check free slots for a cloud audit",
          "book a 30-minute consultation",
        ],
      },
      {
        identifier: "urn:air:cloudless.gr:skills:index",
        displayName: "Agent Skills index",
        type: "application/json",
        url: "https://cloudless.gr/.well-known/agent-skills/index.json",
        representativeQueries: [
          "what agent skills does cloudless.gr publish",
          "how do I book a Cloudless audit as an agent",
        ],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
