import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import JsonLd from "@/components/JsonLd";
import { getOrganizationSchema } from "@/lib/structured-data";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieConsent from "@/components/CookieConsent";

const CartSlideOver = dynamic(() => import("@/components/store/CartSlideOver"));
import ClientDecorators from "@/components/ClientDecorators";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Pre-generate all locale segments so ISR-eligible pages are built once
// and served from CloudFront cache rather than hitting Lambda on every request
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const BASE_URL = "https://cloudless.gr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const pathWithoutLocale = pathname
    .replace(/^\/(en|el|fr)/, "")
    .replace(/\/$/, "");
  const canonical = `${BASE_URL}${locale === "en" ? "" : `/${locale}`}${pathWithoutLocale || ""}`;

  return {
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}${pathWithoutLocale || ""}`,
        el: `${BASE_URL}/el${pathWithoutLocale || ""}`,
        fr: `${BASE_URL}/fr${pathWithoutLocale || ""}`,
        "x-default": `${BASE_URL}${pathWithoutLocale || ""}`,
      },
    },
  };
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
            <JsonLd data={getOrganizationSchema()} />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartSlideOver />
            <ServiceWorkerRegistration />
            <ClientDecorators />
            <CookieConsent />
          </CookieConsentProvider>
        </CartProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
