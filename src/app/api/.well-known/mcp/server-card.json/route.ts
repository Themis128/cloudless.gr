import { NextResponse } from "next/server";

export async function GET() {
  const serverCard = {
    serverInfo: {
      name: "Cloudless.gr Agent Server",
      version: "1.0.0",
      description:
        "MCP server providing access to cloudless.gr services, including chat, calendar, and analytics.",
    },
    transport: {
      type: "sse",
      endpoint: "https://cloudless.gr/api/mcp/sse",
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
  };

  return NextResponse.json(serverCard);
}
