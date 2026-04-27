"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import {
  LayoutDashboard,
  BarChart2,
  Layers,
  Users,
  Link2,
  Building2,
  PenLine,
  FileText,
  FolderKanban,
  Inbox,
  Megaphone,
  Mail,
  GitMerge,
  CalendarDays,
  ClipboardList,
  Bot,
  Mic,
  ShoppingBag,
  UserCog,
  CreditCard,
  FlaskConical,
  Plug,
  AlertTriangle,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

type AdminLink = { href: string; label: string; Icon: LucideIcon };
type AdminGroup = { label: string; links: AdminLink[] };

const adminGroups: AdminGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", Icon: BarChart2 },
      { href: "/admin/analytics/unified", label: "Unified View", Icon: Layers },
    ],
  },
  {
    label: "Clients",
    links: [
      { href: "/admin/crm", label: "CRM", Icon: Users },
      { href: "/admin/client-portals", label: "Client Portals", Icon: Link2 },
      { href: "/admin/workspaces", label: "Workspaces", Icon: Building2 },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/blog", label: "Blog", Icon: PenLine },
      { href: "/admin/docs", label: "Docs", Icon: FileText },
      { href: "/admin/projects", label: "Projects", Icon: FolderKanban },
      { href: "/admin/notion", label: "Submissions", Icon: Inbox },
    ],
  },
  {
    label: "Marketing Hub",
    links: [
      { href: "/admin/campaigns", label: "Campaigns", Icon: Megaphone },
      { href: "/admin/email", label: "Email", Icon: Mail },
      { href: "/admin/pipeline", label: "Pipeline", Icon: GitMerge },
      { href: "/admin/calendar", label: "Calendar", Icon: CalendarDays },
      { href: "/admin/reports", label: "Reports", Icon: ClipboardList },
      { href: "/admin/ai-assistant", label: "AI Assistant", Icon: Bot },
      { href: "/admin/voice-brief", label: "Voice Brief", Icon: Mic },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/orders", label: "Orders", Icon: ShoppingBag },
      { href: "/admin/users", label: "Users", Icon: UserCog },
      {
        href: "/admin/subscriptions",
        label: "Subscriptions",
        Icon: CreditCard,
      },
      { href: "/admin/ab-tests", label: "A/B Tests", Icon: FlaskConical },
      { href: "/admin/integrations", label: "Integrations", Icon: Plug },
      { href: "/admin/errors", label: "Errors", Icon: AlertTriangle },
      { href: "/admin/notifications", label: "Notifications", Icon: Bell },
      { href: "/admin/settings", label: "Settings", Icon: Settings },
    ],
  },
];

function NavList({
  isActive,
  onLinkClick,
}: {
  isActive: (href: string) => boolean;
  onLinkClick?: () => void;
}) {
  return (
    <nav className="space-y-4">
      {adminGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-600">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.links.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onLinkClick}
                  className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 font-mono text-sm transition-all ${
                    active
                      ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20 border"
                      : "text-slate-400 hover:bg-void-lighter/50 hover:text-white"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/auth/login");
      } else if (!isAdmin) {
        router.push("/dashboard");
      }
    }
  }, [user, isAdmin, isLoading, router]);

  if (isLoading || !user || !isAdmin) {
    return (
      <div className="bg-void flex min-h-screen items-center justify-center">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/admin")
      return (
        pathname === "/admin" || Boolean(pathname?.match(/^\/[a-z]{2}\/admin$/))
      );
    return Boolean(pathname?.includes(href));
  };

  return (
    <WorkspaceProvider>
      <div className="bg-void min-h-screen">
        {/* Top bar */}
        <div className="border-neon-magenta/20 bg-neon-magenta/5 border-b">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
              <span className="text-neon-magenta font-mono text-xs">
                ADMIN PANEL
              </span>
            </div>
            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open admin navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="text-neon-magenta p-1 lg:hidden"
            >
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer panel */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-[#0a0a0f] transition-transform duration-300 ease-in-out lg:hidden ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer header */}
          <div className="border-neon-magenta/20 bg-neon-magenta/5 flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
              <span className="text-neon-magenta font-mono text-xs">ADMIN</span>
            </div>
            <button
              type="button"
              aria-label="Close admin navigation"
              onClick={() => setDrawerOpen(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>

          {/* Workspace switcher at top */}
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="mb-1 font-mono text-xs text-slate-500">
              {user.email || user.username}
            </p>
            <WorkspaceSwitcher />
          </div>

          {/* Scrollable nav */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavList
              isActive={isActive}
              onLinkClick={() => setDrawerOpen(false)}
            />
          </div>
        </div>

        {/* Main layout */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Desktop sidebar */}
            <aside className="hidden shrink-0 lg:block lg:w-64">
              <div className="bg-void-light/50 sticky top-24 rounded-xl border border-slate-800 p-4">
                {/* Account + workspace at top */}
                <div className="mb-4 border-b border-slate-800 pb-4">
                  <p className="mb-0.5 font-mono text-xs text-slate-500">
                    {user.email || user.username}
                  </p>
                  <WorkspaceSwitcher />
                </div>
                <NavList isActive={isActive} />
              </div>
            </aside>

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
