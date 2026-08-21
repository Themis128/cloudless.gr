import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getIntegrationAnalytics,
  listPostizIntegrations,
  listPosts,
  getPostStats,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";

interface ChannelSummary {
  id: string;
  name: string;
  platform: string;
  metrics: Record<string, number>;
  percentageChanges: Record<string, number>;
}

interface PostPerformance {
  id: string;
  platform: string;
  content: string;
  publishDate: string;
  likes: number;
  comments: number;
  impressions: number;
  engagement: number;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const lookback = Math.min(Number(url.searchParams.get("days") || "30"), 90) as
    7 | 14 | 30 | 60 | 90;

  try {
    const integrations = await listPostizIntegrations();
    if (!integrations.length) {
      return NextResponse.json({ channels: [], topPosts: [], totals: {} });
    }

    const channels: ChannelSummary[] = [];
    const totals: Record<string, number> = {};

    for (const integ of integrations) {
      if (integ.disabled) continue;
      try {
        const metrics = await getIntegrationAnalytics(integ.id, lookback);
        const channelMetrics: Record<string, number> = {};
        const channelChanges: Record<string, number> = {};
        for (const m of metrics) {
          const latest = m.data.at(-1);
          const val = Number(latest?.total ?? 0);
          channelMetrics[m.label] = val;
          channelChanges[m.label] = m.percentageChange;
          totals[m.label] = (totals[m.label] ?? 0) + val;
        }
        channels.push({
          id: integ.id,
          name: integ.name ?? "",
          platform: integ.identifier ?? "",
          metrics: channelMetrics,
          percentageChanges: channelChanges,
        });
      } catch {
        // skip channels that don't expose analytics
      }
    }

    const since = new Date(Date.now() - lookback * 86400_000).toISOString();
    const until = new Date(Date.now() + 86400_000).toISOString();
    let topPosts: PostPerformance[] = [];

    try {
      const posts = await listPosts(since, until);
      const published = posts.filter((p) => p.state === "PUBLISHED" || p.releaseId);
      const withStats: PostPerformance[] = [];

      for (const post of published.slice(0, 20)) {
        try {
          const stats = await getPostStats(post.id, lookback <= 14 ? 14 : 30);
          const metricMap: Record<string, number> = {};
          for (const s of stats) {
            const latest = s.data.at(-1);
            metricMap[s.label.toLowerCase()] = Number(latest?.total ?? 0);
          }
          withStats.push({
            id: post.id,
            platform: post.integration?.providerIdentifier ?? post.integration?.identifier ?? "",
            content: (post.content ?? "").slice(0, 120),
            publishDate: post.publishDate ?? "",
            likes: metricMap.likes ?? metricMap.reactions ?? 0,
            comments: metricMap.comments ?? metricMap.replies ?? 0,
            impressions: metricMap.impressions ?? metricMap.views ?? 0,
            engagement:
              (metricMap.likes ?? 0) + (metricMap.comments ?? 0) + (metricMap.shares ?? 0),
          });
        } catch {
          // skip posts without analytics
        }
      }

      topPosts = withStats.sort((a, b) => b.engagement - a.engagement).slice(0, 10);
    } catch {
      // posts listing failed
    }

    return NextResponse.json({ channels, topPosts, totals, lookbackDays: lookback });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    throw err;
  }
}
