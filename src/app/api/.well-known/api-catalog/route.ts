import { NextResponse } from "next/server";

export async function GET() {
  const catalog = {
    linkset: [
      {
        anchor: "https://cloudless.gr/api/chat",
        rel: {
          "service-desc": "https://cloudless.gr/api/docs/chat.json",
          "service-doc": "https://cloudless.gr/docs/api/chat",
          "status": "https://cloudless.gr/api/health",
        },
      },
      {
        anchor: "https://cloudless.gr/api/calendar",
        rel: {
          "service-desc": "https://cloudless.gr/api/docs/calendar.json",
          "service-doc": "https://cloudless.gr/docs/api/calendar",
          "status": "https://cloudless.gr/api/health",
        },
      },
      {
        anchor: "https://cloudless.gr/api/analytics",
        rel: {
          "service-desc": "https://cloudless.gr/api/docs/analytics.json",
          "service-doc": "https://cloudless.gr/docs/api/analytics",
          "status": "https://cloudless.gr/api/health",
        },
      },
    ],
  };

  return new NextResponse(JSON.stringify(catalog, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
    },
  });
}