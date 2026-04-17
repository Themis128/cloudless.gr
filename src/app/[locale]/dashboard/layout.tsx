"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: "◈" },
  { href: "/dashboard/profile", label: "Profile", icon: "◉" },
  { href: "/dashboard/purchases", label: "Purchases", icon: "◇" },
  { href: "/dashboard/consultations", label: "Consultations", icon: "📅" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="bg-void flex min-h-screen items-center justify-center">
        <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-void min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="shrink-0 lg:w-64">
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="mb-4 border-b border-slate-800 pb-4">
                <div className="bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan mb-2 flex h-10 w-10 items-center justify-center rounded-full border font-heading text-lg font-bold">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
                <p className="truncate font-mono text-sm font-medium text-white">
                  {user.name || user.email?.split("@")[0] || user.username}
                </p>
                <p className="truncate font-mono text-xs text-slate-500">
                  {user.email || user.username}
                </p>
              </div>
              <nav className="space-y-1">
                {sidebarLinks.map((link) => {
                  const isActive =
                    link.href === "/dashboard"
                      ? pathname === "/dashboard" ||
                        pathname?.match(/^\/[a-z]{2}\/dashboard$/)
                      : pathname?.includes(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm transition-all ${
                        isActive
                          ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 border"
                          : "hover:bg-void-lighter/50 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span>{link.icon}</span>
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
