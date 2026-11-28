export function groupBy<T>(
  items: readonly T[],
  keyFn: (item: T) => PropertyKey
): Record<string, T[]> {
  if (typeof Object.groupBy === "function") {
    return Object.groupBy(items, keyFn) as Record<string, T[]>;
  }
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = String(keyFn(item));
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Object.fromEntries(groups);
}
