/**
 * CartContext provider tails — storage hydration paths, the pre-hydration
 * action queue, and the provider-less useCart guard.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { CartProvider, useCart } from "@/context/CartContext";
import type { StoreProduct } from "@/lib/store-products";

const product: StoreProduct = {
  id: "dig-x",
  name: "Playbook",
  description: "d",
  price: 1000,
  currency: "eur",
  category: "digital",
  image: "/x.svg",
};

const STORAGE_KEY = "cloudless-cart";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Consumer() {
  const cart = useCart();
  return (
    <div>
      <span data-testid="count">{cart.totalItems}</span>
      <span data-testid="open">{String(cart.isOpen)}</span>
      <button data-testid="add" onClick={() => cart.addItem(product)} />
      <button data-testid="toggle" onClick={() => cart.toggleCart()} />
      <button data-testid="close" onClick={() => cart.closeCart()} />
    </div>
  );
}

describe("CartProvider tails", () => {
  it("survives corrupt JSON in storage", () => {
    localStorage.setItem(STORAGE_KEY, "{corrupt");
    const { getByTestId } = render(
      <CartProvider>
        <Consumer />
      </CartProvider>
    );
    expect(getByTestId("count").textContent).toBe("0");
  });

  it("ignores non-array storage payloads", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    const { getByTestId } = render(
      <CartProvider>
        <Consumer />
      </CartProvider>
    );
    expect(getByTestId("count").textContent).toBe("0");
  });

  it("hydrates stored items", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ product, quantity: 2 }]));
    const { getByTestId } = render(
      <CartProvider>
        <Consumer />
      </CartProvider>
    );
    expect(getByTestId("count").textContent).toBe("2");
  });

  it("queues pre-hydration mutations and replays them", () => {
    function Eager() {
      const cart = useCart();
      // Called during the very first render, before the hydration effect —
      // the action must queue in pendingRef rather than dispatch directly.
      if (cart.totalItems === 0) cart.addItem(product);
      return <span data-testid="eager-count">{cart.totalItems}</span>;
    }
    const { getByTestId } = render(
      <CartProvider>
        <Eager />
      </CartProvider>
    );
    expect(getByTestId("eager-count").textContent).toBe("1");
  });

  it("toggleCart and closeCart drive isOpen", () => {
    const { getByTestId } = render(
      <CartProvider>
        <Consumer />
      </CartProvider>
    );
    expect(getByTestId("open").textContent).toBe("false");
    act(() => getByTestId("toggle").click());
    expect(getByTestId("open").textContent).toBe("true");
    act(() => getByTestId("close").click());
    expect(getByTestId("open").textContent).toBe("false");
  });

  it("useCart throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow("useCart must be used within a CartProvider");
    spy.mockRestore();
  });
});
