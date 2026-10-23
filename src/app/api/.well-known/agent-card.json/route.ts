import { NextResponse } from "next/server";

// A2A v0.3 Agent Card — describes the real JSON-RPC adapter at /api/a2a,
// which forwards messages to the Cloudless chat agent (Workers AI loop).
export async function GET() {
  const card = {
    protocolVersion: "0.3.0",
    name: "Cloudless Assistant",
    description:
      "Pre-sales assistant for Cloudless.gr — answers questions about cloud architecture, serverless, AI growth services, and books 30-minute consultation slots.",
    url: "https://cloudless.gr/api/a2a",
    preferredTransport: "JSONRPC",
    version: "1.0.0",
    provider: {
      organization: "Cloudless.gr",
      url: "https://cloudless.gr",
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
      {
        id: "cloud-consultation",
        name: "Cloud consultation assistant",
        description:
          "Answers service and pricing questions and guides visitors to book a free 30-minute cloud audit.",
        tags: ["cloud", "consulting", "booking"],
        examples: [
          "What does the serverless starter package include?",
          "How much does a cloud migration cost?",
          "I'd like to book a free audit",
        ],
      },
    ],
  };

  return NextResponse.json(card);
}
