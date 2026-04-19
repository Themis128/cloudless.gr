import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import CartSlideOver from "@/components/store/CartSlideOver";
import JsonLd from "@/components/JsonLd";
import { getOrganizationSchema } from "@/lib/structured-data";
import LenisProvider from "@/components/LenisProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import CommandPalette from "@/components/CommandPalette";
import NeonCursor from "@/components/NeonCursor";
import KonamiEasterEgg from "@/components/KonamiEasterEgg";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieConsent from "@/components/CookieConsent";

const BASE_URL = "https://cloudless.gr";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || "/";
    }
  }
  return pathname;
}

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const rawPath = headersList.get("x-pathname") ?? "/";
  const canonical = stripLocalePrefix(rawPath);

  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const path = canonical === "/" ? "" : canonical;
    languages[locale] = `${BASE_URL}${prefix}${path}` || `${BASE_URL}/`;
  }
  languages["x-default"] =
    `${BASE_URL}${canonical === "/" ? "" : canonical}` || `${BASE_URL}/`;

  return { alternates: { languages } };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale — returns 404 for unknown segments
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Load messages for NextIntlClientProvider
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <CartProvider>
          <CookieConsentProvider>
            <LenisProvider>
              <JsonLd data={getOrganizationSchema()} />
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartSlideOver />
              <ServiceWorkerRegistration />
              <CommandPalette />
              <NeonCursor />
              <KonamiEasterEgg />
              <CookieConsent />
            </LenisProvider>
          </CookieConsentProvider>
        </CartProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
