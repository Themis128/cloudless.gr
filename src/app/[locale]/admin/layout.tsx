"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/orders", label: "Orders", icon: "◇" },
  { href: "/admin/crm", label: "CRM", icon: "◉" },
  { href: "/admin/analytics", label: "Analytics", icon: "📊" },
  { href: "/admin/errors", label: "Errors", icon: "⚠" },
  { href: "/admin/users", label: "Users", icon: "👤" },
  { href: "/admin/notifications", label: "Notifications", icon: "🔔" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  // Match active link — exact for /admin, startsWith for sub-pages
  const isActive = (href: string) => {
    if (href === "/admin")
      return pathname === "/admin" || pathname?.match(/^\/[a-z]{2}\/admin$/);
    return pathname?.includes(href);
  };

  return (
    <div className="bg-void min-h-screen">
      {/* Admin top bar */}
      <div className="border-neon-magenta/20 bg-neon-magenta/5 border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">
            ADMIN PANEL
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="shrink-0 lg:w-64">
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="mb-4 border-b border-slate-800 pb-4">
                <p className="font-mono text-xs text-slate-500">Admin</p>
                <p className="text-neon-magenta truncate font-mono text-sm">
                  {user.email || user.username}
                </p>
              </div>
              <nav className="space-y-1">
                {adminLinks.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm transition-all ${
                        active
                          ? "b