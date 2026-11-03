import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import messagesRaw from "../src/locales/en.json";
import ConsultationBooking from "@/app/[locale]/consultation/ConsultationBooking";

const messages = messagesRaw as unknown as AbstractIntlMessages;

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [k: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "/"} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/consultation",
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

const SLOTS = [
  { start: "2030-08-28T06:00:00.000Z", end: "2030-08-28T06:30:00.000Z" },
  { start: "2030-08-28T06:30:00.000Z", end: "2030-08-28T07:00:00.000Z" },
  { start: "2030-08-29T07:00:00.000Z", end: "2030-08-29T07:30:00.000Z" },
];

const mockFetch = vi.fn();

function renderWidget() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConsultationBooking />
    </NextIntlClientProvider>
  );
}

describe("ConsultationBooking", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a spinner while availability loads, then renders slots grouped by day", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ slots: SLOTS }), { status: 200 })
    );
    renderWidget();

    expect(screen.getByTestId("slots-loading")).toBeTruthy();

    const grid = await screen.findByTestId("slot-grid");
    expect(grid).toBeTruthy();
    // Two distinct days → two day-group headers
    expect(screen.getAllByText(/Aug/).length).toBeGreaterThanOrEqual(2);
    // Three slot buttons total
    expect(screen.getAllByRole("button", { name: /09:00|09:30|10:00/ }).length).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith("/api/calendar/availability?days=14");
  });

  it("shows the empty state when no slots are returned", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ slots: [] }), { status: 200 }));
    renderWidget();
    expect(await screen.findByTestId("slots-empty")).toBeTruthy();
  });

  it("shows the unavailable fallback when the availability endpoint fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response("down", { status: 503 }));
    renderWidget();
    const box = await screen.findByTestId("booking-unavailable");
    expect(box).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/contact");
  });

  it("shows the unavailable fallback when the availability request throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    renderWidget();
    expect(await screen.findByTestId("booking-unavailable")).toBeTruthy();
  });

  it("back button drops the selection and returns to the slot picker", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ slots: SLOTS }), { status: 200 })
    );
    renderWidget();

    await screen.findByTestId("slot-grid");
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));
    await screen.findByTestId("booking-form");

    fireEvent.click(screen.getByRole("button", { name: /Back to slots/ }));
    expect(screen.queryByTestId("booking-form")).toBeNull();
    await screen.findByTestId("slot-grid");
  });

  it("keeps the error alert when the post-failure slot refresh throws", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ slots: SLOTS }), { status: 200 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockRejectedValueOnce(new Error("refresh down"));
    renderWidget();

    await screen.findByTestId("slot-grid");
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));
    const form = await screen.findByTestId("booking-form");
    fireEvent.change(form.querySelector("#name") as Element, { target: { value: "Jane Doe" } });
    fireEvent.change(form.querySelector("#email") as Element, {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(form.querySelector("#consultation-consent") as Element);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByTestId("booking-form")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("reveals the form on slot pick and posts start/end/name/email to /api/calendar/book", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ slots: SLOTS }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, meetingLink: "https://cal.com/booking/x" }), {
          status: 200,
        })
      );
    renderWidget();

    await screen.findByTestId("slot-grid");
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));

    const form = await screen.findByTestId("booking-form");
    fireEvent.change(form.querySelector("#name") as Element, { target: { value: "Jane Doe" } });
    fireEvent.change(form.querySelector("#email") as Element, {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(form.querySelector("#consultation-consent") as Element);
    fireEvent.submit(form);

    await screen.findByTestId("booking-success");
    const bookCall = mockFetch.mock.calls[1];
    expect(bookCall[0]).toBe("/api/calendar/book");
    const body = JSON.parse((bookCall[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      name: "Jane Doe",
      email: "jane@example.com",
      start: "2030-08-28T06:00:00.000Z",
      end: "2030-08-28T06:30:00.000Z",
    });
  });

  it("stays on the form and alerts when booking fails", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ slots: SLOTS }), { status: 200 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));
    renderWidget();

    await screen.findByTestId("slot-grid");
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));
    const form = await screen.findByTestId("booking-form");
    fireEvent.change(form.querySelector("#name") as Element, { target: { value: "Jane Doe" } });
    fireEvent.change(form.querySelector("#email") as Element, {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(form.querySelector("#consultation-consent") as Element);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("booking-success")).toBeNull();
  });

  it("refreshes availability and drops a just-taken slot when booking fails", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ slots: SLOTS }), { status: 200 }))
      .mockResolvedValueOnce(new Response("conflict", { status: 409 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ slots: SLOTS.slice(1) }), { status: 200 })
      );
    renderWidget();

    await screen.findByTestId("slot-grid");
    fireEvent.click(screen.getByRole("button", { name: "09:00–09:30" }));
    const form = await screen.findByTestId("booking-form");
    fireEvent.change(form.querySelector("#name") as Element, { target: { value: "Jane Doe" } });
    fireEvent.change(form.querySelector("#email") as Element, {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(form.querySelector("#consultation-consent") as Element);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // Form survives — typed data and the error stay visible while the
    // refreshed picker drops the taken slot.
    expect(screen.getByTestId("booking-form")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "09:00–09:30" })).toBeNull());
    expect(screen.getByRole("button", { name: "09:30–10:00" })).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
