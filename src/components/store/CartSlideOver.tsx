"use client";

import { useCart } from "@/context/CartContext";
import { useState } from "react";
import { formatPrice } from "@/lib/format-price";
import ProductIcon from "@/components/store/ProductIcon";

export default function CartSlideOver() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    totalPrice,
    totalItems,
  } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const hasSubscription = items.some((item) => item.product.recurring);
  const hasOneTime = items.some((item) => !item.product.recurring);
  const hasMixedCart = hasSubscription && hasOneTime;

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
      />

      {/* Panel */}
      <div
        className={`bg-void border-neon-cyan/10 fixed top-0 right-0 z-50 h-full w-full max-w-md transform border-l shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-neon-cyan/10 flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-mono text-lg font-bold text-white">
              Cart ({totalItems})
            </h2>
            <button
              onClick={closeCart}
              aria-label="Close cart"
              className="hover:text-neon-cyan active:text-neon-cyan flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-slate-400 transition-colors"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-neon-cyan/40 mb-4 font-mono text-4xl">
                  [ ]
                </div>
                <p className="font-mono text-sm text-slate-400">
                  Your cart is empty
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className="border-neon-cyan/5 flex gap-4 border-b py-4"
                  >
                    {/* Icon */}
                    <div className="bg-void-lighter neon-border h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <ProductIcon
                        productId={item.product.id}
                        category={item.product.category}
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {item.product.name}
                      </h3>
                      <p className="text-neon-cyan mt-1 font-mono text-sm font-medium">
                        {formatPrice(item.product.price, item.product.currency)}
                        {item.product.recurring && `/${item.product.interval}`}
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        {/* Quantity (not for services/subscriptions) */}
                        {!item.product.recurring && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity - 1,
                                )
                              }
                              className="bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 flex h-9 min-h-[36px] w-9 min-w-[36px] items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-400 transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono text-sm font-medium text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity + 1,
                                )
                              }
                              className="bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 flex h-9 min-h-[36px] w-9 min-w-[36px] items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-400 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-neon-magenta/60 hover:text-neon-magenta active:text-neon-magenta ml-auto flex min-h-[44px] items-center font-mono text-xs transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-neon-cyan/10 space-y-4 border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-white">
                  Total
                </span>
                <span className="text-neon-cyan glow-cyan font-mono text-xl font-bold">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              {hasMixedCart && (
                <p className="text-neon-magenta bg-neon-magenta/10 border-neon-magenta/20 rounded-lg border px-3 py-2 font-mono text-xs">
                  Subscriptions and one-time items can&apos;t be purchased
                  together. Please remove one type before checking out.
                </p>
              )}
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut || hasMixedCart}
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 active:bg-neon-cyan/20 min-h-[48px] w-full rounded-lg border py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-40"
              >
                {isCheckingOut ? "Redirecting to Stripe..." : "Checkout"}
              </button>
              <p className="text-center font-mono text-xs text-slate-600">
                Secure payment powered by Stripe
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
