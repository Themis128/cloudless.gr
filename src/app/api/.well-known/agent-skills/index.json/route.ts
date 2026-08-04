import { NextResponse } from "next/server";

export async function GET() {
  const skillsIndex = {
    $schema: "https://agentskills.io/schema/v0.2.0.json",
    skills: [
      {
        name: "Cloudless Chat",
        type: "communication",
        description: "Interact with the Cloudless AI assistant for consulting and support.",
        url: "https://cloudless.gr/api/chat",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
      {
        name: "Calendar Booking",
        type: "scheduling",
        description: "Check availability and book consultations via Google Calendar.",
        url: "https://cloudless.gr/api/calendar",
        sha256: "f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
      },
      {
        name: "Analytics Retrieval",
        type: "data",
        description: "Access marketing and site analytics data.",
        url: "https://cloudless.gr/api/analytics",
        sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      },
    ],
  };

  return NextResponse.json(skillsIndex);
}
