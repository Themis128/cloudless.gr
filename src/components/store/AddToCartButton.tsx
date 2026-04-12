"use client";

import { useCart } from "@/context/CartContext";
import type { StoreProduct } from "@/lib/store-products";

export default function AddToCartButton({ product }: { product: StoreProduct }) {
  const { addItem, toggleCart } = useCart();

  const handleAdd = () => {
    addItem(product);
    toggleCart();
  };

  return (
    <button
      onClick={handleAdd}
      className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 active:bg-neon-cyan/20 min-h-[48px] w-full rounded-lg border px-8 py-4 font-mono text-lg font-semibold transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] active:scale-[0.98]"
    >
      {product.recurring ? "Subscribe" : "Add to Cart"}
    </button>
  );
}
