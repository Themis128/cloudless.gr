/** SocialAuto engagement human-gate client (server-side). */
import { saFetch } from "./socialauto";

export interface GateItem {
  id: string;
  platform: string;
  target_author: string;
  action: "like" | "repost" | "comment";
  score: number;
  comment_draft: string | null;
  status: string;
}

export async function listPendingGates(): Promise<GateItem[]> {
  const r = await saFetch("/engagement/pending", { method: "GET" });
  if (!r.ok) throw new Error(`pending gates: ${r.status}`);
  return (await r.json()) as GateItem[];
}

export async function approveGate(id: string, commentDraft?: string): Promise<GateItem> {
  const r = await saFetch(`/engagement/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commentDraft ? { comment_draft: commentDraft } : {}),
  });
  if (!r.ok) throw new Error(`approve: ${r.status}`);
  return (await r.json()) as GateItem;
}

export async function rejectGate(id: string): Promise<GateItem> {
  const r = await saFetch(`/engagement/${id}/reject`, { method: "POST" });
  if (!r.ok) throw new Error(`reject: ${r.status}`);
  return (await r.json()) as GateItem;
}
