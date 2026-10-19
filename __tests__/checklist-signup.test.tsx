import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import ChecklistSignup from "@/components/ChecklistSignup";

describe("ChecklistSignup", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }))
    );
  });

  it("posts email + magnet slug to /api/subscribe and shows success", async () => {
    render(<ChecklistSignup />);
    fireEvent.change(screen.getByLabelText("Email for checklist updates"), {
      target: { value: "reader@acme.gr" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send it" }).closest("form")!);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/subscribe");
    const payload = JSON.parse(init.body as string);
    expect(payload.email).toBe("reader@acme.gr");
    expect(payload.magnet).toBe("automation-checklist");

    expect(await screen.findByText(/You're on the list/)).toBeTruthy();
  });

  it("shows an error state when subscribe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 }))
    );
    render(<ChecklistSignup />);
    fireEvent.change(screen.getByLabelText("Email for checklist updates"), {
      target: { value: "reader@acme.gr" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Send it" }).closest("form")!);
    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
  });
});
