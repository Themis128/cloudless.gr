import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, within, fireEvent, cleanup } from "@testing-library/react";
import { CartProvider } from "@/context/CartContext";
import ProductIcon from "@/components/store/ProductIcon";
import AddToCartButton from "@/components/store/AddToCartButton";
import CartSlideOver from "@/components/store/CartSlideOver";
import StoreGrid from "@/components/store/StoreGrid";
import type { StoreProduct } from "@/lib/store-products";

afterEach(cleanup);

// Clear localStorage before each test so cart persistence doesn't leak
beforeEach(() => {
  localStorage.clear();
});

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockProduct: StoreProduct = {
  id: "srv-cloud",
  name: "Cloud Architecture Audit",
  description: "Test description",
  price: 200000,
  currency: "eur",
  category: "service",
  image: "/test.svg",
  features: ["Feature A", "Feature B"],
};

const mockRecurringProduct: StoreProduct = {
  id: "srv-growth",
  name: "AI Growth Engine",
  description: "Monthly subscription",
  price: 80000,
  currency: "eur",
  category: "service",
  image: "/test.svg",
  recurring: true,
  interval: "month",
};

const mockDigitalProduct: StoreProduct = {
  id: "dig-cloud-playbook",
  name: "Cloud Migration Playbook",
  description: "Digital product",
  price: 4900,
  currency: "eur",
  category: "digital",
  image: "/test.svg",
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

// Helper: find a filter button by partial text (buttons now include count badges)
function findFilterButton(container: HTMLElement, label: string) {
  return within(container)
    .getAllByRole("button")
    .find((b) => b.textContent?.startsWith(label))!;
}

// ──────────────────────────────────────────
// ProductIcon
// ──────────────────────────────────────────

describe("ProductIcon", () => {
  it("renders the correct SVG icon for a known product ID", () => {
    const { container } = render(
      <ProductIcon productId="srv-cloud" category="service" />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders fallback for an unknown product ID", () => {
    const { container } = render(
      <ProductIcon productId="unknown-id" category="service" />
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBeTruthy();
  });

  it("renders an SVG for each known product ID", () => {
    const knownIds = [
      { id: "srv-cloud", cat: "service" as const },
      { id: "srv-serverless", cat: "service" as const },
      { id: "srv-analytics", cat: "service" as const },
      { id: "srv-growth", cat: "service" as const },
      { id: "dig-cloud-playbook", cat: "digital" as const },
      { id: "dig-analytics-templates", cat: "digital" as const },
      { id: "dig-serverless-course", cat: "digital" as const },
      { id: "phy-dev-kit", cat: "physical" as const },
      { id: "phy-tshirt", cat: "physical" as const },
    ];

    for (const { id, cat } of knownIds) {
      const { container, unmount } = render(
        <ProductIcon productId={id} category={cat} />
      );
      expect(
        container.querySelector("svg"),
        `SVG missing for product ${id}`
      ).toBeTruthy();
      unmount();
    }
  });

  it("applies cyber-grid for known products", () => {
    const { container } = render(
      <ProductIcon productId="srv-cloud" category="service" />
    );
    expect(container.querySelector(".cyber-grid")).toBeTruthy();
  });

  it("uses different fallback symbols per category", () => {
    const results: string[] = [];
    for (const cat of ["service", "digital", "physical"] as const) {
      const { container, unmount } = render(
        <ProductIcon productId="x" category={cat} />
      );
      results.push(container.textContent ?? "");
      unmount();
    }
    expect(new Set(results).size).toBe(3);
  });
});

// ──────────────────────────────────────────
// AddToCartButton
// ──────────────────────────────────────────

describe("AddToCartButton", () => {
  it("renders 'Add to Cart' for one-time products", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
      </Wrapper>
    );
    expect(within(container).getByText("Add to Cart")).toBeTruthy();
  });

  it("renders 'Subscribe' for recurring products", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockRecurringProduct} />
      </Wrapper>
    );
    expect(within(container).getByText("Subscribe")).toBeTruthy();
  });

  it("adds item to cart and opens slide-over on click", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );

    const view = within(container);
    fireEvent.click(view.getByText("Add to Cart"));

    expect(view.getByText("Cloud Architecture Audit")).toBeTruthy();
    expect(view.getByText("Cart (1)")).toBeTruthy();
  });
});

// ──────────────────────────────────────────
// CartSlideOver
// ──────────────────────────────────────────

describe("CartSlideOver", () => {
  it("shows empty cart message when no items", () => {
    const { container } = render(
      <Wrapper>
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);
    expect(view.getByText("Your cart is empty")).toBeTruthy();
    expect(view.getByText("Cart (0)")).toBeTruthy();
  });

  it("displays item details after adding a product", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    expect(view.getByText("Cloud Architecture Audit")).toBeTruthy();
    expect(view.getByText("Checkout")).toBeTruthy();
  });

  it("shows quantity controls for non-recurring products", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockDigitalProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    const incrementButton = view.getByText("+");
    const decrementButton = view.getByText("-");

    expect(incrementButton).toBeTruthy();
    expect(decrementButton).toBeTruthy();
    expect(incrementButton.className).toContain("min-h-[44px]");
    expect(incrementButton.className).toContain("min-w-[44px]");
    expect(decrementButton.className).toContain("min-h-[44px]");
    expect(decrementButton.className).toContain("min-w-[44px]");
  });

  it("increments quantity with + button", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockDigitalProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));
    fireEvent.click(view.getByText("+"));

    expect(view.getByText("2")).toBeTruthy();
    expect(view.getByText("Cart (2)")).toBeTruthy();
  });

  it("removes item with Remove button", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));
    expect(view.getByText("Cloud Architecture Audit")).toBeTruthy();

    fireEvent.click(view.getByText("Remove"));
    expect(view.getByText("Your cart is empty")).toBeTruthy();
  });

  it("renders ProductIcon instead of emoji in cart items", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    // ProductIcon renders an SVG for known product IDs
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("calls fetch on checkout click", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: null }), { status: 200 })
    );

    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));
    fireEvent.click(view.getByText("Checkout"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/checkout",
      expect.objectContaining({ method: "POST" })
    );

    fetchSpy.mockRestore();
  });
});

// ──────────────────────────────────────────
// StoreGrid
// ──────────────────────────────────────────

describe("StoreGrid", () => {
  it("renders all product cards by default", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);

    expect(view.getByText("Cloud Architecture Audit")).toBeTruthy();
    expect(view.getByText("Serverless Starter Package")).toBeTruthy();
    expect(view.getByText("Cloud Migration Playbook")).toBeTruthy();
    expect(view.getByText("Cloudless T-Shirt")).toBeTruthy();
  });

  it("renders category filter buttons with count badges", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const allBtn = findFilterButton(container, "All Products");
    expect(allBtn).toBeTruthy();
    expect(allBtn.textContent).toContain("9");

    expect(findFilterButton(container, "Services")).toBeTruthy();
    expect(findFilterButton(container, "Digital Products")).toBeTruthy();
    expect(findFilterButton(container, "Merch & Physical")).toBeTruthy();
  });

  it("renders a search input", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const search = container.querySelector('input[type="text"]');
    expect(search).toBeTruthy();
    expect(search?.getAttribute("placeholder")).toBe("Search products...");
  });

  it("renders a sort dropdown", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const select = container.querySelector("select");
    expect(select).toBeTruthy();
  });

  it("filters products by search query", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);
    const search = container.querySelector('input[type="text"]')!;

    fireEvent.change(search, { target: { value: "serverless" } });

    expect(view.getByText("Serverless Starter Package")).toBeTruthy();
    expect(view.getByText("Serverless Masterclass")).toBeTruthy();
    expect(view.queryByText("Cloudless T-Shirt")).toBeNull();
  });

  it("shows empty state when search has no results", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);
    const search = container.querySelector('input[type="text"]')!;

    fireEvent.change(search, { target: { value: "xyznonexistent" } });

    expect(view.getByText("No products match your search.")).toBeTruthy();
    expect(view.getByText("Clear filters")).toBeTruthy();
  });

  it("sorts products by price ascending", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const select = container.querySelector("select")!;

    fireEvent.change(select, { target: { value: "price-asc" } });

    const cards = container.querySelectorAll('a[href^="/store/"]');
    // First card should link to cheapest product (phy-tshirt at 2500)
    expect(cards[0]?.getAttribute("href")).toBe("/store/phy-tshirt");
  });

  it("filters products by category when a filter is clicked", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(findFilterButton(container, "Digital Products"));

    expect(view.getByText("Cloud Migration Playbook")).toBeTruthy();
    expect(view.getByText("Analytics Dashboard Templates")).toBeTruthy();
    expect(view.getByText("Serverless Masterclass")).toBeTruthy();

    expect(view.queryByText("Cloud Architecture Audit")).toBeNull();
    expect(view.queryByText("Cloudless T-Shirt")).toBeNull();
  });

  it("shows all products again when 'All Products' is clicked", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(findFilterButton(container, "Digital Products"));
    expect(view.queryByText("Cloud Architecture Audit")).toBeNull();

    fireEvent.click(findFilterButton(container, "All Products"));
    expect(view.getByText("Cloud Architecture Audit")).toBeTruthy();
    expect(view.getByText("Cloudless T-Shirt")).toBeTruthy();
  });

  it("renders product links pointing to /store/{id}", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const links = container.querySelectorAll('a[href^="/store/"]');
    expect(links.length).toBeGreaterThanOrEqual(9);
  });

  it("renders Add to Cart and Subscribe buttons on cards", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );
    const view = within(container);

    const addButtons = view.getAllByText("Add to Cart");
    expect(addButtons.length).toBeGreaterThanOrEqual(8);
    // The recurring product should show "Subscribe"
    expect(view.getAllByText("Subscribe").length).toBeGreaterThanOrEqual(1);
  });

  it("renders ProductIcon SVGs inside cards", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    // 9 product SVGs + 1 search icon SVG = at least 10
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(10);
  });

  it("has 44px minimum touch targets on filter buttons", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const filterButtons = within(container)
      .getAllByRole("button")
      .filter((b) => b.textContent?.match(/All Products|Services|Digital|Merch/));

    for (const btn of filterButtons) {
      expect(
        btn.className.includes("min-h-[44px]"),
        `Filter button "${btn.textContent}" missing min-h-[44px]`
      ).toBe(true);
    }
  });

  it("has 44px minimum touch targets on Add to Cart buttons in cards", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const addButtons = within(container).getAllByText("Add to Cart");
    for (const btn of addButtons) {
      expect(
        btn.className.includes("min-h-[44px]"),
        "Add to Cart button missing min-h-[44px]"
      ).toBe(true);
    }
  });

  it("has active: states on Add to Cart buttons for mobile tap feedback", () => {
    const { container } = render(
      <Wrapper>
        <StoreGrid />
      </Wrapper>
    );

    const addButtons = within(container).getAllByText("Add to Cart");
    for (const btn of addButtons) {
      expect(
        btn.className.includes("active:"),
        "Add to Cart button missing active: state"
      ).toBe(true);
    }
  });
});

// ──────────────────────────────────────────
// CartSlideOver — Mobile Touch Targets
// ──────────────────────────────────────────

describe("CartSlideOver — Mobile", () => {
  it("has 44px+ touch target on close button", () => {
    const { container } = render(
      <Wrapper>
        <CartSlideOver />
      </Wrapper>
    );

    // Close button has min-w-[44px] and min-h-[44px]
    const closeBtn = within(container)
      .getAllByRole("button")
      .find((b) => b.querySelector("svg path[d*='4 4l12 12']"));

    expect(closeBtn?.className).toContain("min-w-[44px]");
    expect(closeBtn?.className).toContain("min-h-[44px]");
  });

  it("has 44px+ touch target on checkout button", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    const checkoutBtn = view.getByText("Checkout");
    expect(checkoutBtn.className).toContain("min-h-[48px]");
  });

  it("has active: state on checkout button for mobile tap feedback", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    const checkoutBtn = view.getByText("Checkout");
    expect(checkoutBtn.className).toContain("active:");
  });

  it("uses rounded-lg on cart item icons and checkout button", () => {
    const { container } = render(
      <Wrapper>
        <AddToCartButton product={mockProduct} />
        <CartSlideOver />
      </Wrapper>
    );
    const view = within(container);

    fireEvent.click(view.getByText("Add to Cart"));

    // Checkout button uses rounded-lg
    const checkoutBtn = view.getByText("Checkout");
    expect(checkoutBtn.className).toContain("rounded-lg");

    // Cart item icon container uses rounded-lg
    const iconContainers = container.querySelectorAll(".neon-border");
    const hasRoundedLg = Array.from(iconContainers).some((el) =>
      el.className.includes("rounded-lg")
    );
    expect(hasRoundedLg).toBe(true);
  });
});
