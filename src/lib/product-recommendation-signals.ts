export interface ProductOrderSignal {
  productId: string;
  relatedProductId: string;
  count: number;
}

export function buildCoPurchaseSignals(orderProductIds: string[][]): ProductOrderSignal[] {
  const counts = new Map<string, number>();

  for (const rawProductIds of orderProductIds) {
    const uniqueProductIds = [...new Set(rawProductIds.map((id) => id.trim()).filter(Boolean))];

    for (const productId of uniqueProductIds) {
      for (const relatedProductId of uniqueProductIds) {
        if (productId === relatedProductId) continue;

        const key = `${productId}\u0000${relatedProductId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [productId, relatedProductId] = key.split("\u0000");

      return {
        productId,
        relatedProductId,
        count,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.productId.localeCompare(b.productId) ||
        a.relatedProductId.localeCompare(b.relatedProductId),
    );
}
