// @vitest-environment jsdom
/**
 * AdminLayoutClient tails — auth redirects + mobile drawer open/close.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...p}>{children}</a>
  ),
  usePathname: () => "/en/admin",
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("@/context/WorkspaceContext", () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkspace: () => ({ workspaces: [], current: null, loaded: true, switchTo: vi.fn() }),
}));

import AdminLayoutClient from "@/app/[locale]/admin/AdminLayoutClient";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminLayoutClient tails", () => {
  it("redirects unauthenticated users to login", () => {
    mockUseAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: false });
    render(<AdminLayoutClient><div>x</div></AdminLayoutClient>);
    expect(mockPush).toHaveBeenCalledWith("/auth/login?next=/admin");
  });

  it("redirects non-admin users to the dashboard", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, isAdmin: false, isLoading: false });
    render(<AdminLayoutClient><div>x</div></AdminLayoutClient>);
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("opens and closes the mobile drawer", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, isAdmin: true, isLoading: false });
    render(<AdminLayoutClient><div>body</div></AdminLayoutClient>);
    const openBtn = screen.getByLabelText("Open admin navigation");
    expect(openBtn.getAttribute("aria-expanded")).toBe("false");

    // open → backdrop + close button appear
    fireEvent.click(openBtn);
    expect(openBtn.getAttribute("aria-expanded")).toBe("true");
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeTruthy();

    // backdrop click closes
    fireEvent.click(backdrop!);
    expect(openBtn.getAttribute("aria-expanded")).toBe("false");

    // open again → close button inside the drawer
    fireEvent.click(openBtn);
    const closeBtn = screen.getByLabelText("Close admin navigation");
    fireEvent.click(closeBtn);
    expect(openBtn.getAttribute("aria-expanded")).toBe("false");
  });
});
