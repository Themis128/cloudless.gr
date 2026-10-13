// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderConfirmation from "@/emails/OrderConfirmation";

describe("OrderConfirmation email", () => {
  it("renders defaults when no props are given", () => {
    render(<OrderConfirmation orderId="" total="" />);
    expect(screen.getByText("Order Confirmed")).toBeTruthy();
  });

  it("renders the order id and total", () => {
    render(<OrderConfirmation orderId="cs_test_abc" total="€149.00" />);
    expect(screen.getByText("cs_test_abc")).toBeTruthy();
    expect(screen.getByText("€149.00")).toBeTruthy();
    expect(screen.getByText(/Order confirmed: €149.00/, { selector: "div" })).toBeTruthy();
  });
});
