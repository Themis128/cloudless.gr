// Workflow routes are only available when running on Cloudflare Workers.
// For Next.js API routes, we return a message indicating this.
// Use the workflow via the Worker directly at /api/agents/workflows/hello

// Static export compatibility - Worker handles API routes
export const dynamic = "force-static";
export const revalidate = 3600;

export async function POST() {
  return Response.json(
    {
      ok: false,
      error:
        "Workflows are only available when running on Cloudflare Workers. Deploy with 'pnpm cf:deploy' to use.",
    },
    { status: 503 }
  );
}

export async function GET() {
  return Response.json(
    {
      ok: false,
      error:
        "Workflows are only available when running on Cloudflare Workers. Deploy with 'pnpm cf:deploy' to use.",
    },
    { status: 503 }
  );
}
