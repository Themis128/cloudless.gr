import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Simple in-memory counter state (for demo purposes)
// In production, this would be backed by DynamoDB or similar
const counters = new Map<string, number>();

export async function POST(request: NextRequest) {
  // Add rate limiting
  const rl = rateLimit(`counter-agent:${getClientIp(request)}`, 10, 60_000);
  if (!rl.ok) return rl.response;
  // Add authentication check
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const method = url.searchParams.get("method");
  const instance = "default";

  try {
    switch (method) {
      case "increment": {
        const current = counters.get(instance) ?? 0;
        const newCount = current + 1;
        counters.set(instance, newCount);
        return NextResponse.json({ count: newCount });
      }

      case "decrement": {
        const current = counters.get(instance) ?? 0;
        const newCount = Math.max(0, current - 1);
        counters.set(instance, newCount);
        return NextResponse.json({ count: newCount });
      }

      case "reset": {
        counters.set(instance, 0);
        return NextResponse.json({ count: 0 });
      }

      case "getCount": {
        const count = counters.get(instance) ?? 0;
        return NextResponse.json({ count });
      }

      default:
        return NextResponse.json(
          { error: "Unknown method. Use: increment, decrement, reset, getCount" },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
