import { NextResponse } from "next/server";

// MCP server card — describes the real Streamable HTTP JSON-RPC endpoint at
// /api/mcp (tools only: no resources/prompts are implemented).
export async function GET() {
  const serverCard = {
    serverInfo: {
      name: "cloudless-gr",
      title: "Cloudless.gr Agent Server",
      version: "1.0.0",
      description:
        "MCP server exposing the Cloudless.gr assistant and consultation booking — check availability, book a slot, or ask the assistant.",
    },
    transport: {
      type: "streamable-http",
      endpoint: "https://cloudless.gr/api/mcp",
    },
    protocolVersion: "2025-03-26",
    capabilities: {
      tools: true,
    },
  };

  return NextResponse.json(serverCard);
}
