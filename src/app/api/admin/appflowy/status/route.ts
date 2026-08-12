/**
 * /api/admin/appflowy/status — backed by AppFlowy
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured, listAllWorkspaces, listWorkspaceViews, getDocument, extractDocText, AppFlowyNotConfiguredError } from "@/lib/appflowy";

interface DbStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  count: number;
  sample: Record<string, unknown>[];
  error?: string;
}

async function probeAppFlowyDatabase(name: string, workspaceId: string, limit = 5): Promise<DbStatus> {
  try {
    const views = await listWorkspaceViews(workspaceId);
    const sample = [];
    
    for (const view of views.slice(0, limit)) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        sample.push({
          id: view.view_id,
          name: view.name,
          type: view.type,
          lastEdited: view.last_edited_time,
          contentPreview: text.slice(0, 200),
        });
      } catch {
        // Skip failed documents
      }
    }

    return {
      name,
      configured: true,
      connected: true,
      count: views.length,
      sample,
    };
  } catch (err: unknown) {
    console.error(`[appflowy-status] ${name} failed:`, err);
    return {
      name,
      configured: true,
      connected: false,
      count: 0,
      sample: [],
      error: "upstream-appflowy-error",
    };
  }
}

async function resolveBotName(): Promise<{ ok: true; botName: string } | { ok: false; response: NextResponse }> {
  try {
    // AppFlowy doesn't have a direct "bot" concept, but we can get the workspace info
    const workspaces = await listAllWorkspaces();
    return {
      ok: true,
      botName: workspaces[0]?.workspace_name ?? "AppFlowy Workspace",
    };
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json({ authenticated: false, error: "AppFlowy not configured" }, { status: 200 }),
    };
  }
}

const PROBE_TARGETS: Array<string> = [
  "Blog",
  "Docs", 
  "Projects",
  "Tasks",
  "Submissions",
  "Analytics",
  "Case Studies",
  "FAQs",
  "Services",
  "Testimonials",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const configured = await isAppFlowyConfigured();
  
  if (!configured) {
    return NextResponse.json({ 
      authenticated: false, 
      error: "AppFlowy not configured. Set APPFLOWY_API_KEY and APPFLOWY_BASE_URL in .env.local",
      databases: [] 
    }, { status: 200 });
  }

  try {
    const bot = await resolveBotName();
    if (!bot.ok) return bot.response;

    const workspaces = await listAllWorkspaces();
    const workspaceId = workspaces[0]?.workspace_id;
    
    if (!workspaceId) {
      return NextResponse.json({ 
        authenticated: true,
        botName: bot.botName,
        databases: PROBE_TARGETS.map(name => ({
          name,
          configured: true,
          connected: false,
          count: 0,
          sample: [],
          error: "No workspace found"
        }))
      });
    }

    const databases = await Promise.all(
      PROBE_TARGETS.map(name => probeAppFlowyDatabase(name, workspaceId))
    );

    return NextResponse.json({
      authenticated: true,
      botName: bot.botName,
      databases,
    });
  } catch (err) {
    if (err instanceof AppFlowyNotConfiguredError) {
      return NextResponse.json({ 
        authenticated: false, 
        error: "AppFlowy not configured",
        databases: [] 
      }, { status: 200 });
    }
    console.error("[appflowy-status] Error:", err);
    return NextResponse.json({ 
      authenticated: false, 
      error: err instanceof Error ? err.message : "Unknown error",
      databases: [] 
    }, { status: 200 });
  }
}