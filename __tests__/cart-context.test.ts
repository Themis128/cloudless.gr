import { describe, it, expect } from "vitest";
import { cartReducer } from "@/context/CartContext";
import type { StoreProduct } from "@/lib/store-products";

const mockProduct: StoreProduct = {
  id: "test-1",
  name: "Test Product",
  description: "A test product",
  price: 1000,
  currency: "eur",
  category: "digital",
  image: "/test.svg",
};

const mockProduct2: StoreProduct = {
  id: "test-2",
  name: "Another Product",
  description: "Another test product",
  price: 2000,
  currency: "eur",
  category: "service",
  image: "/test2.svg",
};

const emptyState = { items: [], isOpen: false };

describe("cartReducer", () => {
  it("starts with an empty state", () => {
    expect(emptyState.items).toHaveLength(0);
    expect(emptyState.isOpen).toBe(false);
  });

  it("adds an item to the cart", () => {
    const state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });

    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe("test-1");
    expect(state.items[0].quantity).toBe(1);
  });

  it("increments quantity when adding the same item twice", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "ADD_ITEM", product: mockProduct });

    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });

  it("handles multiple different products", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "ADD_ITEM", product: mockProduct2 });

    expect(state.items).toHaveLength(2);
    const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    expect(totalItems).toBe(2);
    expect(totalPrice).toBe(3000);
  });

  it("removes an item by product ID", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "ADD_ITEM", product: mockProduct2 });
    state = cartReducer(state, { type: "REMOVE_ITEM", productId: "test-1" });

    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe("test-2");
  });

  it("updates quantity of an item", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", productId: "test-1", quantity: 5 });

    expect(state.items[0].quantity).toBe(5);
  });

  it("removes item when quantity is set to zero", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "UPDATE_QUANTITY", productId: "test-1", quantity: 0 });

    expect(state.items).toHaveLength(0);
  });

  it("clears all items", () => {
    let state = cartReducer(emptyState, { type: "ADD_ITEM", product: mockProduct });
    state = cartReducer(state, { type: "ADD_ITEM", product: mockProduct2 });
    state = cartReducer(state, { type: "CLEAR_CART" });

    expect(state.items).toHaveLength(0);
  });

  it("toggles cart open/closed", () => {
    let state = cartReducer(emptyState, { type: "TOGGLE_CART" });
    expect(state.isOpen).toBe(true);
    state = cartReducer(state, { type: "TOGGLE_CART" });
    expect(state.isOpen).toBe(false);
  });

  it("closes the cart explicitly", () => {
    let state = cartReducer(emptyState, { type: "TOGGLE_CART" });
    expect(state.isOpen).toBe(true);
    state = cartReducer(state, { type: "CLOSE_CART" });
    expect(state.isOpen).toBe(false);
  });
});
