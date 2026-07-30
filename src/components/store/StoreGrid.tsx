"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/context/CartContext";
import {
  defaultProducts,
  categoryLabels,
  categoryColors,
  type ProductCategory,
  type StoreProduct,
} from "@/lib/store-products-client";
import { formatPrice } from "@/lib/format-price";
import ProductIcon from "@/components/store/ProductIcon";
import { trackFunnelEvent } from "@/lib/funnel-client";

const categories: ("all" | ProductCategory)[] = ["all", "service", "digital", "physical"];

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;
const LOCAL_FALLBACK_SOURCE = "local-fallback";

const sortLabels: Record<SortOption, string> = {
  default: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A to Z",
};

const categoryCounts: Record<"all" | ProductCategory, number> = {
  all: defaultProducts.length,
  service: defaultProducts.filter((p) => p.category === "service").length,
  digital: defaultProducts.filter((p) => p.category === "digital").length,
  physical: defaultProducts.filter((p) => p.category === "physical").length,
};

function localKeywordFilter(products: StoreProduct[], query: string): StoreProduct[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.features && p.features.some((f) => f.toLowerCase().includes(q)))
  );
}

function orderByHitIds(products: StoreProduct[], hitIds: string[]): StoreProduct[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered: StoreProduct[] = [];
  for (const id of hitIds) {
    const product = byId.get(id);
    if (product) ordered.push(product);
  }
  return ordered;
}

function ProductCard({
  product,
  onNavigate,
}: {
  product: StoreProduct;
  onNavigate?: (productId: string) => void;
}) {
  const { addItem } = useCart();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group neon-border bg-void-light/50 overflow-hidden rounded-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Product infographic */}
      <div className="bg-void-lighter relative aspect-4/3 overflow-hidden">
        <ProductIcon productId={product.id} category={product.category} />
        <span
          className={`absolute top-4 left-4 rounded-full px-3 py-1 font-mono text-[10px] font-medium ${
            categoryColors[product.category]
          }`}
        >
          {categoryLabels[product.category]}
        </span>

        {/* Hover feature preview */}
        {product.features && product.features.length > 0 && (
          <div
            className={`bg-void/90 absolute inset-0 flex flex-col justify-center px-6 backdrop-blur-sm transition-opacity duration-300 ${
              hovered ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <p className="text-neon-cyan/60 mb-3 font-mono text-[10px] font-medium tracking-[0.3em]">
              INCLUDES
            </p>
            <ul className="space-y-2">
              {product.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-neon-cyan mt-0.5 shrink-0">&#x25B8;</span>
                  {f}
                </li>
              ))}
              {product.features.length > 4 && (
                <li className="font-mono text-xs text-slate-400">
                  +{product.features.length - 4} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <Link href={`/store/${product.id}`} onClick={() => onNavigate?.(product.id)}>
          <h3 className="font-heading group-hover:text-neon-cyan text-lg font-semibold text-white transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm text-slate-400">{product.description}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-neon-cyan font-mono text-xl font-bold">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.recurring && (
              <span className="ml-1 font-mono text-sm text-slate-400">/{product.interval}</span>
            )}
          </div>
          <button
            onClick={() => addItem(product)}
            className="bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/20 active:bg-neon-cyan/20 min-h-11 rounded-lg border px-4 py-2.5 font-mono text-xs font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(0,255,245,0.15)] active:scale-[0.98]"
          >
            {product.recurring ? "Subscribe" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreGrid() {
  const [activeCategory, setActiveCategory] = useState<"all" | ProductCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  // Keyed by query so a new keystroke ignores stale hit order without sync setState.
  const [semanticSearch, setSemanticSearch] = useState<{
    query: string;
    hitIds: string[] | null;
    source: string | null;
  }>({ query: "", hitIds: null, source: null });

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      return;
    }

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      const url = `/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`;
      globalThis
        .fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`search ${res.status}`);
          const data = (await res.json()) as {
            source?: string;
            hits?: Array<{ id?: string }>;
          };
          const ids = Array.isArray(data.hits)
            ? data.hits.map((h) => h.id).filter((id): id is string => Boolean(id))
            : [];
          const source = typeof data.source === "string" ? data.source : "api";
          setSemanticSearch({ query: q, hitIds: ids, source });
          trackFunnelEvent("search_query", { query: q, source });
          trackFunnelEvent("search_result", {
            query: q,
            source,
            result_ids: ids,
            result_count: ids.length,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          console.warn("[StoreGrid] /api/search failed; using local keyword filter:", err);
          setSemanticSearch({ query: q, hitIds: null, source: LOCAL_FALLBACK_SOURCE });
          trackFunnelEvent("search_query", { query: q, source: LOCAL_FALLBACK_SOURCE });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const qTrim = searchQuery.trim();
  const semanticHitIds = semanticSearch.query === qTrim ? semanticSearch.hitIds : null;
  const searchSource = semanticSearch.query === qTrim ? semanticSearch.source : null;

  const filtered = useMemo(() => {
    let products =
      activeCategory === "all"
        ? defaultProducts
        : defaultProducts.filter((p) => p.category === activeCategory);

    const q = searchQuery.trim();
    if (q) {
      if (semanticHitIds && semanticHitIds.length > 0) {
        products = orderByHitIds(products, semanticHitIds);
      } else if (semanticHitIds && semanticHitIds.length === 0) {
        // Authoritative empty result from /api/search
        products = [];
      } else {
        // Loading or API error — snappy local keyword fallback
        products = localKeywordFilter(products, q);
      }
    }

    if (sortBy !== "default") {
      products = [...products].sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        return a.name.localeCompare(b.name);
      });
    }

    return products;
  }, [activeCategory, searchQuery, sortBy, semanticHitIds]);

  function handleSearchClick(productId: string) {
    const q = searchQuery.trim();
    if (!q) return;
    trackFunnelEvent("search_click", {
      query: q,
      product_id: productId,
      source: searchSource ?? LOCAL_FALLBACK_SOURCE,
    });
  }

  return (
    <>
      {/* Search + Sort bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search products"
            data-search-source={searchSource ?? undefined}
            className="bg-void-light focus:border-neon-cyan/50 w-full rounded-lg border border-slate-800 py-2.5 pr-4 pl-10 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <select
          aria-label="Sort products"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="bg-void-light focus:border-neon-cyan/50 cursor-pointer rounded-lg border border-slate-800 px-4 py-2.5 font-mono text-sm text-slate-400 transition-colors focus:outline-none"
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="mb-10 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`min-h-11 rounded-lg px-4 py-2.5 font-mono text-xs font-medium transition-all duration-300 ${
              activeCategory === cat
                ? "bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan border shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                : "bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 border border-slate-800 text-slate-400 hover:text-slate-300 active:text-slate-300"
            }`}
          >
            {cat === "all" ? "All Products" : categoryLabels[cat]}
            <span className="ml-2 text-[10px] opacity-60">{categoryCounts[cat]}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <h2 className="sr-only">Products</h2>
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={searchQuery.trim() ? handleSearchClick : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <div className="text-neon-cyan/40 mb-4 font-mono text-4xl">[ ]</div>
          <p className="font-mono text-sm text-slate-400">No products match your search.</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("all");
            }}
            className="text-neon-cyan/60 hover:text-neon-cyan mt-4 font-mono text-xs transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
