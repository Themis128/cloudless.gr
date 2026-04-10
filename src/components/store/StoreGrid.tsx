"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductIcon from "@/components/store/ProductIcon";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format-price";
import {
  categoryColors,
  categoryLabels,
  type ProductCategory,
  type StoreProduct,
} from "@/lib/store-products-client";

const categories: ("all" | ProductCategory)[] = ["all", "service", "digital", "physical"];

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc";

const sortLabels: Record<SortOption, string> = {
  default: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A to Z",
};

function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group neon-border bg-void-light/50 overflow-hidden rounded-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="bg-void-lighter relative aspect-[4/3] overflow-hidden">
        <ProductIcon productId={product.id} category={product.category} />
        <span
          className={`absolute top-4 left-4 rounded-full px-3 py-1 font-mono text-[10px] font-medium ${
            categoryColors[product.category]
          }`}
        >
          {categoryLabels[product.category]}
        </span>

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
              {product.features.slice(0, 4).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-neon-cyan mt-0.5 shrink-0">&#x25B8;</span>
                  {feature}
                </li>
              ))}
              {product.features.length > 4 && (
                <li className="font-mono text-xs text-slate-500">
                  +{product.features.length - 4} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="p-6">
        <Link href={`/store/${product.id}`}>
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
              <span className="ml-1 font-mono text-sm text-slate-500">/{product.interval}</span>
            )}
          </div>
          <button
            onClick={() => addItem(product)}
            className="bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/20 active:bg-neon-cyan/20 min-h-[44px] rounded-lg border px-4 py-2.5 font-mono text-xs font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(0,255,245,0.15)] active:scale-[0.98]"
          >
            {product.recurring ? "Subscribe" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreGrid({ products }: { products: StoreProduct[] }) {
  const [activeCategory, setActiveCategory] = useState<"all" | ProductCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const categoryCounts = useMemo(
    () => ({
      all: products.length,
      service: products.filter((product) => product.category === "service").length,
      digital: products.filter((product) => product.category === "digital").length,
      physical: products.filter((product) => product.category === "physical").length,
    }),
    [products],
  );

  const filtered = useMemo(() => {
    let visibleProducts =
      activeCategory === "all"
        ? products
        : products.filter((product) => product.category === activeCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      visibleProducts = visibleProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          (product.features && product.features.some((feature) => feature.toLowerCase().includes(query))),
      );
    }

    if (sortBy !== "default") {
      visibleProducts = [...visibleProducts].sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        return a.name.localeCompare(b.name);
      });
    }

    return visibleProducts;
  }, [activeCategory, products, searchQuery, sortBy]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
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
            onChange={(event) => setSearchQuery(event.target.value)}
            className="bg-void-light focus:border-neon-cyan/50 w-full rounded-lg border border-slate-800 py-2.5 pr-4 pl-10 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          className="bg-void-light focus:border-neon-cyan/50 cursor-pointer rounded-lg border border-slate-800 px-4 py-2.5 font-mono text-sm text-slate-400 transition-colors focus:outline-none"
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-10 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`min-h-[44px] rounded-lg px-4 py-2.5 font-mono text-xs font-medium transition-all duration-300 ${
              activeCategory === category
                ? "bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan border shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                : "bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 border border-slate-800 text-slate-500 hover:text-slate-300 active:text-slate-300"
            }`}
          >
            {category === "all" ? "All Products" : categoryLabels[category]}
            <span className="ml-2 text-[10px] opacity-60">{categoryCounts[category]}</span>
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <div className="text-neon-cyan/20 mb-4 font-mono text-4xl">[ ]</div>
          <p className="font-mono text-sm text-slate-500">No products match your search.</p>
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
