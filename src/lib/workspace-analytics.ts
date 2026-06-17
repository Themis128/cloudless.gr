import { readWorkspaces, type Workspace } from "@/lib/workspace-server";
import { readPortals, type ClientPortal } from "@/lib/client-portals";
import { getCalendarItems, type CalendarItem } from "@/lib/content-calendar";
import { scoreClientHealth } from "@/lib/client-health";

/**
 * Cross-store analytics for a workspace.
 *
 * Joins three data sources by `workspaceId`:
 *   - workspaces SSM (metadata + postizGroupId + notionTag)
 *   - client-portals SSM (portals, deliverables, payment links)
 *   - Notion calendar (items tagged WorkspaceID)
 *
 * Industry pattern: multi-tenant SaaS analytics aggregate via a per-tenant
 * id index. Each consumer just calls `aggregateWorkspaceAnalytics(ws.id)` and
 * gets a denormalised summary it can render directly.
 *
 * Org-wide rows (no workspaceId) DON'T count against any single workspace —
 * they live in a separate `orgWide` bucket in the all-workspaces variant.
 */

export interface WorkspaceAnalytics {
  workspaceId: string | null;
  workspace: Pick<Workspace, "id" | "name" | "slug"> | null;
  portals: {
    total: number;
    active: number;
    expiringSoon: number;
    averageHealth: number;
    expired: number;
  };
  deliverables: {
    total: number;
    inReview: number;
    approved: number;
    changesRequested: number;
    draft: number;
  };
  revenue: {
    openCount: number;
    paidCount: number;
    voidCount: number;
    openAmountCents: number;
    paidAmountCents: number;
    currency: string;
  };
  calendar: {
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    cancelled: number;
    nextScheduledAt: string | null;
  };
}

export const EXPIRING_SOON_DAYS = 14;

/** Determine if a portal is expired or expiring soon. Exported for testability. */
export function bucketPortal(portal: ClientPortal) {
  const now = Date.now();
  let expired = false;
  let expiringSoon = false;
  if (portal.expiresAt) {
    const expMs = Date.parse(portal.expiresAt);
    if (Number.isFinite(expMs)) {
      if (expMs < now) expired = true;
      else if (expMs - now < EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000) expiringSoon = true;
    }
  }
  return { expired, expiringSoon };
}

/** Create a zeroed-out analytics object. Exported for testability. */
export function emptyAnalytics(workspaceId: string | null): WorkspaceAnalytics {
  return {
    workspaceId,
    workspace: null,
    portals: { total: 0, active: 0, expiringSoon: 0, averageHealth: 0, expired: 0 },
    deliverables: { total: 0, inReview: 0, approved: 0, changesRequested: 0, draft: 0 },
    revenue: {
      openCount: 0,
      paidCount: 0,
      voidCount: 0,
      openAmountCents: 0,
      paidAmountCents: 0,
      currency: "EUR",
    },
    calendar: {
      total: 0,
      draft: 0,
      scheduled: 0,
      published: 0,
      cancelled: 0,
      nextScheduledAt: null,
    },
  };
}

/** Aggregate portal data into an analytics object. Exported for testability. */
export function reducePortals(out: WorkspaceAnalytics, portals: ClientPortal[]): void {
  let healthSum = 0;
  let healthCount = 0;
  for (const p of portals) {
    out.portals.total += 1;
    const { expired, expiringSoon } = bucketPortal(p);
    if (expired) {
      out.portals.expired += 1;
    } else {
      out.portals.active += 1;
      if (expiringSoon) out.portals.expiringSoon += 1;
    }
    const score = scoreClientHealth(p)?.score;
    if (typeof score === "number") {
      healthSum += score;
      healthCount += 1;
    }
    for (const d of p.deliverables ?? []) {
      out.deliverables.total += 1;
      if (d.status === "in_review") out.deliverables.inReview += 1;
      else if (d.status === "approved") out.deliverables.approved += 1;
      else if (d.status === "changes_requested") out.deliverables.changesRequested += 1;
      else out.deliverables.draft += 1;
    }
    for (const l of p.paymentLinks ?? []) {
      if (l.status === "open") {
        out.revenue.openCount += 1;
        out.revenue.openAmountCents += l.amountCents ?? 0;
      } else if (l.status === "paid") {
        out.revenue.paidCount += 1;
        out.revenue.paidAmountCents += l.amountCents ?? 0;
      } else {
        out.revenue.voidCount += 1;
      }
      // First non-EUR currency wins as the display currency for the
      // workspace — most agencies bill a client in one currency.
      if (l.currency && l.currency !== "EUR" && out.revenue.currency === "EUR") {
        out.revenue.currency = l.currency;
      }
    }
  }
  out.portals.averageHealth = healthCount > 0 ? Math.round(healthSum / healthCount) : 0;
}

/** Aggregate calendar items into an analytics object. Exported for testability. */
export function reduceCalendar(out: WorkspaceAnalytics, items: CalendarItem[]): void {
  const nowIso = new Date().toISOString();
  let nextScheduled: string | null = null;
  for (const i of items) {
    out.calendar.total += 1;
    if (i.status === "draft") out.calendar.draft += 1;
    else if (i.status === "scheduled") {
      out.calendar.scheduled += 1;
      if (i.date >= nowIso && (!nextScheduled || i.date < nextScheduled)) {
        nextScheduled = i.date;
      }
    } else if (i.status === "published") out.calendar.published += 1;
    else if (i.status === "cancelled") out.calendar.cancelled += 1;
  }
  out.calendar.nextScheduledAt = nextScheduled;
}

/** Aggregate analytics for ONE workspace. */
export async function aggregateWorkspaceAnalytics(
  workspaceId: string
): Promise<WorkspaceAnalytics> {
  const [workspaces, portals, calendarAll] = await Promise.all([
    readWorkspaces(),
    readPortals(),
    getCalendarItems(),
  ]);
  const workspace = workspaces.find((w) => w.id === workspaceId) ?? null;
  const out = emptyAnalytics(workspaceId);
  if (workspace) {
    out.workspace = { id: workspace.id, name: workspace.name, slug: workspace.slug };
  }
  reducePortals(
    out,
    portals.filter((p) => p.workspaceId === workspaceId)
  );
  reduceCalendar(
    out,
    calendarAll.filter((c) => c.workspaceId === workspaceId)
  );
  return out;
}

/** Aggregate analytics for ALL workspaces in one pass + an "orgWide" bucket
 *  for portals/calendar rows that don't carry a workspaceId. */
export async function aggregateAllWorkspaceAnalytics(): Promise<{
  workspaces: WorkspaceAnalytics[];
  orgWide: WorkspaceAnalytics;
}> {
  const [workspaces, portals, calendarAll] = await Promise.all([
    readWorkspaces(),
    readPortals(),
    getCalendarItems(),
  ]);
  const byId = new Map<string, WorkspaceAnalytics>();
  for (const ws of workspaces) {
    const a = emptyAnalytics(ws.id);
    a.workspace = { id: ws.id, name: ws.name, slug: ws.slug };
    byId.set(ws.id, a);
  }
  const orgWide = emptyAnalytics(null);

  // Partition portals.
  const portalsByWs = new Map<string, ClientPortal[]>();
  const portalsOrgWide: ClientPortal[] = [];
  for (const p of portals) {
    if (p.workspaceId && byId.has(p.workspaceId)) {
      const list = portalsByWs.get(p.workspaceId) ?? [];
      list.push(p);
      portalsByWs.set(p.workspaceId, list);
    } else {
      portalsOrgWide.push(p);
    }
  }
  // Partition calendar.
  const calendarByWs = new Map<string, CalendarItem[]>();
  const calendarOrgWide: CalendarItem[] = [];
  for (const c of calendarAll) {
    if (c.workspaceId && byId.has(c.workspaceId)) {
      const list = calendarByWs.get(c.workspaceId) ?? [];
      list.push(c);
      calendarByWs.set(c.workspaceId, list);
    } else {
      calendarOrgWide.push(c);
    }
  }

  for (const ws of workspaces) {
    const out = byId.get(ws.id);
    if (!out) continue;
    reducePortals(out, portalsByWs.get(ws.id) ?? []);
    reduceCalendar(out, calendarByWs.get(ws.id) ?? []);
  }
  reducePortals(orgWide, portalsOrgWide);
  reduceCalendar(orgWide, calendarOrgWide);

  return { workspaces: [...byId.values()], orgWide };
}
