"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import CartButton from "@/components/store/CartButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useCurrentLocale();
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const toggleMenuLabel = translate(locale, "navbar.toggleMenu", "Toggle menu");
  const cartLabel = translate(locale, "common.cart", "Cart");
  const languageLabel = translate(locale, "navbar.language", "Language");
  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* QD-inspired top accent bar */}
      <div className="bg-neon-cyan h-px shadow-[0_0_10px_rgba(0,255,245,0.5)]" />
      <div className="bg-void/90 border-neon-cyan/10 border-b backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center text-white transition-opacity hover:opacity-90"
            aria-label="cloudless.gr — home"
          >
            <Logo variant="wordmark" size="md" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neon-cyan font-mono text-sm font-medium text-slate-400 transition-colors duration-200"
              >
                {translate(locale, link.key, link.fallback)}
              </Link>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <CartButton />
              <LocaleSwitcher />
            </div>
            {!isLoading && (
              <>
                {user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="hover:border-neon-cyan/30 flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-slate-300 transition-all hover:text-white"
                    >
                      <span className="bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan flex h-6 w-6 items-center justify-center rounded-full border text-xs">
                        {(user.name ||
                          user.email ||
                          user.username ||
                          "U")[0].toUpperCase()}
                      </span>
                      <span className="hidden max-w-[120px] truncate xl:inline">
                        {user.name ||
                          user.email?.split("@")[0] ||
                          user.username}
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
                            {translate(
                              locale,
                              "navbar.adminPanel",
                              "Admin Panel",
                            )}
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
                      href="/auth/login"
                      className="border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 relative rounded-lg border bg-transparent px-5 py-2.5 font-mono text-sm font-semibold whitespace-nowrap transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,245,0.2)]"
                    >
                      {translate(locale, "navbar.signIn", "Sign In")}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="hover:border-neon-cyan/30 hover:text-neon-cyan relative rounded-lg border border-slate-700 bg-transparent px-5 py-2.5 font-mono text-sm font-semibold whitespace-nowrap text-slate-300 transition-all duration-300"
                    >
                      {translate(locale, "navbar.signUp", "Sign Up")}
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
          >
            {mobileOpen ? (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        <div
          className={`bg-void/95 border-neon-cyan/10 overflow-y-auto border-t px-6 backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden ${
            mobileOpen
              ? "max-h-[calc(100svh-4rem)] py-4 opacity-100"
              : "max-h-0 py-0 opacity-0"
          }`}
        >
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-neon-cyan active:text-neon-cyan active:scale-95 flex min-h-11 items-center py-3 font-mono text-sm font-medium text-slate-400 transition-all"
                onClick={() => setMobileOpen(false)}
              >
                <span className="text-neon-cyan/40 mr-2">&gt;</span>
                {translate(locale, link.key, link.fallback)}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 pb-1">
              <span className="font-mono text-xs text-slate-500">
                {cartLabel}
              </span>
              <CartButton />
            </div>
            <div className="mt-2 border-t border-slate-800 pt-1 pb-1">
              <span className="mb-2 block font-mono text-xs text-slate-500">
                {languageLabel}
              </span>
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
                    className={`min-h-11 min-w-[64px] rounded-lg border px-3 py-2 font-mono text-sm transition-all active:scale-95 ${
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
                          <span className="text-neon-magenta/40 mr-2">
                            &gt;
                          </span>
                          {translate(
                            locale,
                            "navbar.adminPanel",
                            "Admin Panel",
                          )}
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
                      href="/auth/login"
                      className="border-neon-cyan/50 text-neon-cyan active:bg-neon-cyan/10 mt-2 block min-h-11 rounded-lg border px-5 py-3 text-center font-mono text-sm font-semibold transition-all"
                      onClick={() => setMobileOpen(false)}
                    >
                      {translate(locale, "navbar.signIn", "Sign In")}
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="mt-2 block min-h-11 rounded-lg border border-slate-700 px-5 py-3 text-center font-mono text-sm font-semibold text-slate-300 transition-all hover:border-neon-cyan/30 hover:text-neon-cyan"
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
