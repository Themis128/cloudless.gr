"use client";

import { useCart } from "@/context/CartContext";

export default function CartButton() {
  const { toggleCart, totalItems, isOpen } = useCart();

  return (
    <button
      onClick={toggleCart}
      data-testid="cart"
      className="relative flex min-h-11 min-w-11 items-center justify-center p-2 text-slate-300 transition-colors hover:text-white"
      aria-label={isOpen ? "Close cart" : "Open cart"}
      aria-expanded={isOpen}
    >
      <svg
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 10a4 4 0 01-8 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {totalItems > 0 && (
        <span className="bg-neon-cyan text-void absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
          {totalItems}
        </span>
      )}
    </button>
  );
}
