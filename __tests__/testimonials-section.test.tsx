import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TestimonialsSection from "@/components/TestimonialsSection";
import type { Testimonial } from "@/lib/cms-static";

afterEach(() => cleanup());

const base: Testimonial = {
  id: "t1",
  name: "Jane Doe",
  company: "Acme",
  role: "CTO",
  quote: "Great work.",
  rating: 5,
  featured: false,
};

describe("TestimonialsSection", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<TestimonialsSection locale="en" items={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("testimonials-section")).toBeNull();
  });

  it("renders the section heading and testimonial cards", () => {
    render(<TestimonialsSection locale="en" items={[base]} />);
    expect(screen.getByTestId("testimonials-section")).toBeTruthy();
    expect(screen.getByText(/What clients/)).toBeTruthy();
    expect(screen.getByText(/Great work\./)).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("CTO")).toBeTruthy();
  });

  it("sorts featured testimonials first and caps at 3", () => {
    const items: Testimonial[] = [
      { ...base, id: "a", name: "A One", featured: false },
      { ...base, id: "b", name: "B Two", featured: true },
      { ...base, id: "c", name: "C Three", featured: false },
      { ...base, id: "d", name: "D Four", featured: false },
    ];
    render(<TestimonialsSection locale="en" items={items} />);
    const names = screen.getAllByText(/^[A-D] (One|Two|Three|Four)$/).map((el) => el.textContent);
    expect(names).toEqual(["B Two", "A One", "C Three"]);
  });

  it("falls back to company when role is empty", () => {
    render(
      <TestimonialsSection locale="en" items={[{ ...base, role: "", company: "FallbackCo" }]} />
    );
    expect(screen.getByText("FallbackCo")).toBeTruthy();
  });

  it("renders star rating only when rating is set", () => {
    const { container, rerender } = render(
      <TestimonialsSection locale="en" items={[{ ...base, rating: 4 }]} />
    );
    expect(container.querySelector('[aria-label="4 out of 5 stars"]')).toBeTruthy();

    rerender(<TestimonialsSection locale="en" items={[{ ...base, rating: undefined }]} />);
    expect(container.querySelector('[aria-label$="out of 5 stars"]')).toBeNull();
  });

  it("localizes the heading for el", () => {
    render(<TestimonialsSection locale="el" items={[base]} />);
    expect(screen.getByText("[ ΜΑΡΤΥΡΙΕΣ ]")).toBeTruthy();
    expect(screen.queryByText("[ TESTIMONIALS ]")).toBeNull();
  });
});
