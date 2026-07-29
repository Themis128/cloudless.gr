"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format-price";
import ProductIcon from "@/components/store/ProductIcon";
import HolographicCard from "@/components/HolographicCard";
import ScrollReveal from "@/components/ScrollReveal";
import { trackFunnelEvent } from "@/lib/funnel-client";
import type { StoreProduct } from "@/lib/store-products";

interface RecommendationGridProps {
  type: "similar" | "trending";
  productIds?: string[];
  limit?: number;
  title?: string;
  subtitle?: string;
}

type ExpState = {
  enabled: boolean;
  variant: "a" | "b";
};

export default function RecommendationGrid({
  type,
  productIds,
  limit = 4,
  title,
  subtitle,
}: RecommendationGridProps) {
  const [recommendations, setRecommendations] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [exp, setExp] = useState<ExpState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const expRes = await globalThis.fetch("/api/experiments/store-recommendations");
        let nextExp: ExpState = { enabled: false, variant: "a" };
        if (expRes.ok) {
          const data = (await expRes.json()) as { enabled?: boolean; variant?: string };
          nextExp = {
            enabled: Boolean(data.enabled),
            variant: data.variant === "b" ? "b" : "a",
          };
        }
        if (cancelled) return;
        setExp(nextExp);

        const hide = nextExp.enabled && nextExp.variant === "b";
        trackFunnelEvent("rec_impression", {
          ab_variant: nextExp.variant,
          shown: !hide,
          type,
        });

        if (hide) {
          setRecommendations([]);
          return;
        }

        const params = new URLSearchParams({ type, limit: limit.toString() });
        if (productIds && productIds.length > 0) {
          params.set("productIds", productIds.join(","));
        }

        const res = await globalThis.fetch(`/api/recommendations?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch recommendations");

        const data = (await res.json()) as StoreProduct[];
        if (!cancelled) setRecommendations(data);
      } catch (err) {
        console.error("[RecommendationGrid] Error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, productIds, limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(limit)].map((_, i) => (
          <div
            key={i}
            className="bg-void-light h-64 animate-pulse rounded-xl border border-slate-800"
          />
        ))}
      </div>
    );
  }

  if (exp?.enabled && exp.variant === "b") return null;
  if (recommendations.length === 0) return null;

  return (
    <div className="py-12">
      {title && (
        <div className="mb-8">
          <p className="animate-shimmer-text mb-2 font-mono text-[10px] font-medium tracking-[0.3em]">
            [ {subtitle || "RECOMMENDED"} ]
          </p>
          <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">{title}</h2>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {recommendations.map((product, i) => (
          <ScrollReveal key={product.id} delay={i * 100}>
            <Link
              href={`/store/${product.id}`}
              className="group block"
              onClick={() =>
                trackFunnelEvent("rec_click", {
                  product_id: product.id,
                  ab_variant: exp?.variant ?? "a",
                  type,
                })
              }
            >
              <HolographicCard className="bg-void-light/50 hover:border-neon-cyan/50 h-full rounded-xl border border-slate-800 transition-colors">
                <div className="bg-void-lighter relative aspect-square overflow-hidden rounded-t-xl">
                  <ProductIcon productId={product.id} category={product.category} />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="p-5">
                  <h3 className="font-heading group-hover:text-neon-cyan mb-1 line-clamp-1 text-sm font-semibold text-white transition-colors">
                    {product.name}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-xs text-slate-500">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-neon-cyan font-mono text-sm font-bold">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    <span className="text-neon-cyan/40 font-mono text-[10px] tracking-widest uppercase">
                      View details
                    </span>
                  </div>
                </div>
              </HolographicCard>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
