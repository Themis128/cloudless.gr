"use client";

import { useCart } from "@/context/CartContext";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format-price";
import ProductIcon from "@/components/store/ProductIcon";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

/* Cart drawer — MWG `navigation-drawer` pattern: a modal <dialog> whose
 * horizontal scroll-snap position IS the open/closed state. The sheet's
 * scroll offset drives the gesture natively (touch swipe, momentum,
 * interruption), an IntersectionObserver closes the dialog once the sheet
 * leaves the viewport, and every dismissal path (swipe, backdrop tap, Esc,
 * close button) converges on the same scroll-to-closed animation. */
export default function CartSlideOver() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    clearCart,
    totalPrice,
    totalItems,
  } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // CartContext value isn't memoized — closeCart gets a new identity every
  // render, so the gesture effect below reads it through a ref and runs once.
  const closeCartRef = useRef(closeCart);
  useEffect(() => {
    closeCartRef.current = closeCart;
  }, [closeCart]);
  // Only treat a below-threshold intersection as "closed" after the sheet
  // was actually seen open — otherwise the observer's initial ratio-0
  // delivery during the open scroll animation would slam the drawer shut.
  const sawOpenRef = useRef(false);

  // Shared dismiss path for every close gesture (backdrop tap, Esc cancel,
  // close button via isOpen, swipe settle): animate the sheet to the closed
  // stop — re-arming sawOpen so the observer still detects the return even
  // when the open was interrupted before the sheet passed ~50% visibility —
  // or close instantly when already parked at the stop.
  const dismissDrawer = () => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    if (!dialog || !scroller || !dialog.open) return;
    /* v8 ignore start -- browser-only; jsdom lacks scrollTo/dialog.close */
    if (typeof scroller.scrollTo === "function" && scroller.scrollLeft > 1) {
      sawOpenRef.current = true;
      scroller.scrollTo({ left: 0, behavior: "auto" });
    } else if (typeof dialog.close === "function") {
      dialog.close();
      closeCartRef.current();
    }
    /* v8 ignore stop */
  };

  // Gesture layer: backdrop fade fallback, open/closed detection, and the
  // light-dismiss / Esc handlers. All of it needs real layout, scroll-snap,
  // IntersectionObserver and scroll-timeline APIs that jsdom lacks.
  useEffect(() => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!dialog || !scroller || !sheet) return;
    /* v8 ignore start -- browser-only gesture layer; jsdom has no IO/scrollTo */
    if (typeof IntersectionObserver === "undefined" || typeof scroller.scrollTo !== "function") {
      return;
    }

    const maxScroll = () => scroller.scrollWidth - scroller.clientWidth;

    // Backdrop fade fallback where scroll-driven animations are unsupported:
    // map scroll progress onto --cart-backdrop (0 closed → 1 open).
    let onScroll: (() => void) | undefined;
    if (!CSS.supports("animation-timeline", "scroll()")) {
      onScroll = () => {
        const range = Math.max(maxScroll(), 1);
        dialog.style.setProperty(
          "--cart-backdrop",
          String(Math.min(1, Math.max(0, scroller.scrollLeft / range)))
        );
      };
      scroller.addEventListener("scroll", onScroll, { passive: true });
    }

    // IntersectionObserver on the sheet is the source of truth for state —
    // it fires however the sheet moved (swipe, programmatic scroll, snap).
    const visibleThreshold = 1 / window.innerWidth;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry || !dialog.open) return;
        if (entry.intersectionRatio > 0.5) sawOpenRef.current = true;
        if (entry.intersectionRatio < visibleThreshold && sawOpenRef.current) {
          // Sheet fully left the viewport — finish closing the dialog and
          // sync React state so data-open/isOpen reflect reality.
          sawOpenRef.current = false;
          if (typeof dialog.close === "function") dialog.close();
          closeCartRef.current();
        }
      },
      // root: dialog makes the ratio reflect the sheet's visibility inside
      // the drawer viewport (how much of it has been swiped on-screen).
      { root: dialog, threshold: [visibleThreshold, 1] }
    );
    observer.observe(sheet);

    // Parked-at-closed-stop backstop: a scroll-settle debounce is the
    // reliable signal for swipe-to-close — including swipes that interrupt
    // the open animation before sawOpen was ever set.
    const closeIfParked = () => {
      if (dialog.open && scroller.scrollLeft <= 1) {
        if (typeof dialog.close === "function") dialog.close();
        closeCartRef.current();
      }
    };
    let settleTimer: number | undefined;
    const onScrollSettled = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(closeIfParked, 150);
    };
    scroller.addEventListener("scroll", onScrollSettled, { passive: true });

    // Light dismiss: taps on the dimmed spacer area close the drawer. Do NOT
    // use closedby="any" — the dialog fills the viewport so taps land on the
    // dialog rather than ::backdrop, and it would close without the slide-out.
    const handleClick = (e: MouseEvent) => {
      if (!sheet.contains(e.target as Node)) dismissDrawer();
    };
    dialog.addEventListener("click", handleClick);

    // Esc fires `cancel` on modal dialogs — prevent the instant close and
    // animate the sheet out instead. Non-cancelable repeats close instantly.
    const handleCancel = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
        dismissDrawer();
      }
    };
    dialog.addEventListener("cancel", handleCancel);

    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      scroller.removeEventListener("scroll", onScrollSettled);
      if (onScroll) scroller.removeEventListener("scroll", onScroll);
      dialog.removeEventListener("click", handleClick);
      dialog.removeEventListener("cancel", handleCancel);
    };
    /* v8 ignore stop */
  }, []);

  // React state → drawer position. Opening promotes the dialog to the top
  // layer (inert page, focus containment/return, scroll lock, Esc) then
  // scrolls the sheet into view; scrollLeft 0 is already the closed stop,
  // so scrolling to max animates it in from off-screen right.
  useEffect(() => {
    const dialog = dialogRef.current;
    const scroller = scrollerRef.current;
    if (!dialog || !scroller) return;
    /* v8 ignore start -- showModal/scrollTo are absent in jsdom */
    if (isOpen) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
        scroller.scrollTo({
          left: scroller.scrollWidth - scroller.clientWidth,
          behavior: "auto",
        });
      }
    } else {
      dismissDrawer();
    }
    /* v8 ignore stop */
  }, [isOpen]);

  // Escape fallback for environments without native dialog Esc handling
  // (jsdom, legacy embeds); real browsers close via `cancel` above which
  // animates the sheet out. Idempotent either way. Never steals Esc from
  // another modal <dialog> layered above the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const d of document.querySelectorAll("dialog[open]")) {
        if (d !== dialogRef.current) return;
      }
      closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeCart]);

  const hasSubscription = items.some((item) => item.product.recurring);
  const hasOneTime = items.some((item) => !item.product.recurring);
  const hasMixedCart = hasSubscription && hasOneTime;

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      /* v8 ignore start -- unreachable: the Checkout button is disabled while hasMixedCart, so handleCheckout can never run in this state */
      if (hasMixedCart) {
        setCheckoutError(
          "Subscriptions and one-time items can't be purchased together. Please remove one type before checking out."
        );
        setIsCheckingOut(false);
        return;
      }
      /* v8 ignore stop */
      // fetchWithAuth attaches the id_token when signed in, so the
      // checkout route can pre-fill customer_email and tag the session with
      // userId — linking the order to the account. Anonymous carts still work
      // (no token → anonymous checkout).
      const res = await fetchWithAuth("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        clearCart();
        window.location.href = data.url;
        return;
      }
      // Surface the failure instead of silently resetting the button.
      setCheckoutError(data.error ?? "Checkout failed. Please try again.");
    } catch {
      setCheckoutError("Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-testid="cart-drawer"
      data-open={isOpen ? "true" : "false"}
      aria-label="Shopping cart"
      className="cart-drawer"
    >
      <div ref={scrollerRef} className="cart-drawer-scroller">
        <div ref={sheetRef} className="cart-drawer-sheet">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-neon-cyan/10 flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-mono text-lg font-bold text-white">Cart ({totalItems})</h2>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="hover:text-neon-cyan active:text-neon-cyan flex min-h-11 min-w-11 items-center justify-center p-2 text-slate-400 transition-colors"
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
                  <div className="text-neon-cyan/40 mb-4 font-mono text-4xl">[ ]</div>
                  <p className="font-mono text-sm text-slate-400">Your cart is empty</p>
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
                        <ProductIcon productId={item.product.id} category={item.product.category} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {item.product.name}
                        </h3>
                        {item.product.unknown && (
                          <p className="text-neon-magenta bg-neon-magenta/10 border-neon-magenta/20 rounded-lg border px-3 py-2 font-mono text-xs">
                            Unknown product in cart. Please remove this item.
                          </p>
                        )}
                        <p className="text-neon-cyan mt-1 font-mono text-sm font-medium">
                          {item.product.unknown
                            ? "Unknown price"
                            : formatPrice(item.product.price, item.product.currency)}
                          {item.product.recurring && `/${item.product.interval}`}
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                          {/* Quantity (not for services/subscriptions) */}
                          {!item.product.recurring && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-400 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-mono text-sm font-medium text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="bg-void-light hover:border-neon-cyan/30 active:border-neon-cyan/30 flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-400 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}

                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="text-neon-magenta/60 hover:text-neon-magenta active:text-neon-magenta ml-auto flex min-h-11 items-center font-mono text-xs transition-colors"
                            disabled={item.product.unknown}
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
                  <span className="font-mono text-sm font-semibold text-white">Total</span>
                  <span className="text-neon-cyan glow-cyan font-mono text-xl font-bold">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
                {hasMixedCart && (
                  <p className="text-neon-magenta bg-neon-magenta/10 border-neon-magenta/20 rounded-lg border px-3 py-2 font-mono text-xs">
                    Subscriptions and one-time items can&apos;t be purchased together. Please remove
                    one type before checking out.
                  </p>
                )}
                {checkoutError && (
                  <p
                    role="alert"
                    className="text-neon-magenta bg-neon-magenta/10 border-neon-magenta/20 rounded-lg border px-3 py-2 font-mono text-xs"
                  >
                    {checkoutError}
                  </p>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut || hasMixedCart}
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 active:bg-neon-cyan/20 min-h-12 w-full rounded-lg border py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-40"
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
      </div>
    </dialog>
  );
}
