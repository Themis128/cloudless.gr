"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import CartButton from "@/components/store/CartButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeSwitcher, { ThemeSwitcherInline } from "@/components/ThemeSwitcher";
import Logo from "@/components/Logo";
import { translate, locales, localeLabels, type Locale } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/", key: "common.home", fallback: "Home" },
  { href: "/services", key: "common.services", fallback: "Services" },
  { href: "/store", key: "common.store", fallback: "Store" },
  { href: "/blog", key: "common.blog", fallback: "Blog" },
  { href: "/contact", key: "common.contact", fallback: "Contact" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useCurrentLocale();
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const toggleMenuLabel = translate(locale, "navbar.toggleMenu", "Toggle menu");
  const cartLabel = translate(locale, "common.cart", "Cart");
  const languageLabel = translate(locale, "navbar.language", "Language");
  const themeLabel = translate(locale, "common.theme", "Theme");
  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-200${scrolled ? "[box-shadow:var(--shadow-md)]" : ""}`}
    >
      {/* Top accent stripe */}
      <div className="bg-neon-cyan h-0.5" />
      <div
        className="border-b backdrop-blur-xl"
        style={{ background: "var(--surface-glass)", borderColor: "var(--border-subtle)" }}
      >
        <nav
          data-testid="main-nav"
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"
        >
          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center transition-opacity hover:opacity-90"
            style={{ color: "var(--ink-primary)" }}
            aria-label={translate(locale, "common.home", "Home")}
          >
            <Logo variant="wordmark" size="md" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-5 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neon-cyan font-mono text-sm font-medium transition-colors duration-200"
                style={{ color: "var(--ink-body)" }}
              >
                {translate(locale, link.key, link.fallback)}
              </Link>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <CartButton />
              <ThemeSwitcher />
              <LocaleSwitcher />
            </div>
            {!isLoading && (
              <>
                {user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      aria-expanded={userMenuOpen}
                      aria-haspopup="true"
                      className="hover:border-neon-cyan/30 flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-slate-300 transition-all hover:text-white"
                    >
                      <span className="bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan flex h-6 w-6 items-center justify-center rounded-full border text-xs">
                        {(user.name || user.email || user.username || "U")[0].toUpperCase()}
                      </span>
                      <span className="hidden max-w-30 truncate xl:inline">
                        {user.name || user.email?.split("@")[0] || user.username}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="text-slate-500"
                      >
                        <path
                          d="M3 5l3 3 3-3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    {userMenuOpen && (
                      <div className="bg-void-light/95 absolute top-full right-0 z-50 mt-2 w-48 rounded-xl border border-slate-800 py-1 shadow-xl backdrop-blur-xl">
                        <Link
                          href="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="hover:text-neon-cyan hover:bg-neon-cyan/5 block px-4 py-2.5 font-mono text-sm text-slate-300 transition-all"
                        >
                          {translate(locale, "navbar.dashboard", "Dashboard")}
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="hover:text-neon-magenta hover:bg-neon-magenta/5 block px-4 py-2.5 font-mono text-sm text-slate-300 transition-all"
                          >
                            {translate(locale, "navbar.adminPanel", "Admin Panel")}
                          </Link>
                        )}
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            signOut();
                          }}
                          className="hover:text-neon-magenta hover:bg-neon-magenta/5 block w-full px-4 py-2.5 text-left font-mono text-sm text-slate-400 transition-all"
                        >
                          {translate(locale, "navbar.signOut", "Sign Out")}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Link
                      href="/contact"
                      className="bg-accent hover:bg-accent/90 rounded-lg px-4 py-2.5 font-mono text-sm font-semibold whitespace-nowrap text-[var(--accent-on)] transition-all duration-300"
                    >
                      {translate(locale, "navbar.freeAudit", "Get a Free Audit")}
                    </Link>
                    <Link
                      href="/auth/login"
                      className="border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 relative rounded-lg border bg-transparent px-4 py-2.5 font-mono text-sm font-semibold whitespace-nowrap transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,245,0.2)]"
                    >
                      {translate(locale, "navbar.signIn", "Sign In")}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="text-neon-cyan p-2 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={toggleMenuLabel}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        <div
          className={`overflow-x-hidden overflow-y-auto border-t px-6 backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden ${
            mobileOpen ? "max-h-[calc(100svh-4rem)] py-4 opacity-100" : "max-h-0 py-0 opacity-0"
          }`}
          style={{ background: "var(--surface-glass)", borderColor: "var(--border-subtle)" }}
        >
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neon-cyan active:text-neon-cyan flex min-h-11 items-center py-3 font-mono text-sm font-medium transition-all active:scale-95"
                style={{ color: "var(--ink-body)" }}
                onClick={() => setMobileOpen(false)}
              >
                <span style={{ color: "var(--accent)", opacity: 0.5 }} className="mr-2">
                  &gt;
                </span>
                {translate(locale, link.key, link.fallback)}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 pb-1">
              <span className="font-mono text-xs text-slate-500">{cartLabel}</span>
              <CartButton />
            </div>
            <div className="mt-2 border-t border-slate-800 pt-1 pb-1">
              <span className="mb-2 block font-mono text-xs text-slate-500">{themeLabel}</span>
              <ThemeSwitcherInline />
            </div>
            <div className="mt-2 border-t border-slate-800 pt-1 pb-1">
              <span className="mb-2 block font-mono text-xs text-slate-500">{languageLabel}</span>
              <div className="flex flex-wrap gap-2">
                {locales.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLocale(l as Locale);
                      setMobileOpen(false);
                    }}
                    aria-label={`Set language to ${localeLabels[l]}`}
                    aria-pressed={l === locale}
                    className={`min-h-11 min-w-16 rounded-lg border px-3 py-2 font-mono text-sm transition-all active:scale-95 ${
                      l === locale
                        ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                        : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {!isLoading && (
              <>
                {user ? (
                  <>
                    <div className="mt-2 border-t border-slate-800 pt-2">
                      <span className="mb-1 block font-mono text-xs text-slate-500">
                        {translate(locale, "navbar.account", "Account")}
                      </span>
                      <Link
                        href="/dashboard"
                        className="active:text-neon-cyan flex min-h-11 items-center py-3 font-mono text-sm font-medium text-slate-400 transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="text-neon-cyan/40 mr-2">&gt;</span>
                        {translate(locale, "navbar.dashboard", "Dashboard")}
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="active:text-neon-magenta flex min-h-11 items-center py-3 font-mono text-sm font-medium text-slate-400 transition-colors"
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="text-neon-magenta/40 mr-2">&gt;</span>
                          {translate(locale, "navbar.adminPanel", "Admin Panel")}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          signOut();
                        }}
                        className="active:text-neon-magenta block min-h-11 w-full py-3 text-left font-mono text-sm font-medium text-slate-400 transition-colors"
                      >
                        <span className="text-neon-magenta/40 mr-2">&gt;</span>
                        {translate(locale, "navbar.signOut", "Sign Out")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/contact"
                      className="bg-accent hover:bg-accent/90 mt-2 block min-h-11 rounded-lg px-5 py-3 text-center font-mono text-sm font-semibold text-[var(--accent-on)] transition-all"
                      onClick={() => setMobileOpen(false)}
                    >
                      {translate(locale, "navbar.freeAudit", "Get a Free Audit")}
                    </Link>
                    <Link
                      href="/auth/login"
                      className="border-neon-cyan/50 text-neon-cyan active:bg-neon-cyan/10 mt-2 block min-h-11 rounded-lg border px-5 py-3 text-center font-mono text-sm font-semibold transition-all"
                      onClick={() => setMobileOpen(false)}
                    >
                      {translate(locale, "navbar.signIn", "Sign In")}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="hover:border-neon-cyan/30 hover:text-neon-cyan mt-2 block min-h-11 rounded-lg border border-slate-700 px-5 py-3 text-center font-mono text-sm font-semibold text-slate-300 transition-all"
                      onClick={() => setMobileOpen(false)}
                    >
                      {translate(locale, "navbar.signUp", "Sign Up")}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// CloudIcon removed — replaced by the shared <Logo /> component.
