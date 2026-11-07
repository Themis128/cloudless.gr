/**
 * Tracks in-flight Slack event handlers so tests can deterministically drain
 * them. The events route answers Slack within its 3s window and processes
 * events fire-and-forget; without a drain hook, tests race fixed sleeps.
 */

const inflight = new Set<Promise<void>>();

export function trackSlackEvent(work: Promise<void>): void {
  inflight.add(work);
  void work.finally(() => {
    inflight.delete(work);
  });
}

/** Resolves once every tracked handler (including stragglers) has settled. */
export async function drainSlackEvents(): Promise<void> {
  while (inflight.size > 0) {
    await Promise.allSettled([...inflight]);
  }
}
