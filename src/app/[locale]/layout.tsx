import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
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
import GoogleAnalyticsConsent from "@/components/GoogleAnalyticsConsent";
import ClientCartSlideOver from "@/components/ClientCartSlideOver";
import ClientChatWidget from "@/components/ClientChatWidget";
import ClientDecorators from "@/components/ClientDecorators";
import AttributionCapture from "@/components/AttributionCapture";
import ConsentGatedPixel from "@/components/ConsentGatedPixel";
import LinkedInInsightTag from "@/components/LinkedInInsightTag";
import HtmlLangSync from "@/components/HtmlLangSync";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const LINKEDIN_PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID ?? "";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Pre-generate all locale segments so ISR-eligible pages are built once
// and served from CloudFront cache rather than hitting Lambda on every request
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Only en|el|fr|de are valid `[locale]` values. Without this, Turbopack can
// bind `/api/auth/session` as locale=`api` + missing `auth/session` page → HTML 404.
export const dynamicParams = false;

const BASE_URL = "https://cloudless.gr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<import("next").Metadata> {
  const { locale } = await params;

  const ogLocaleMap: Record<string, string> = {
    en: "en_US",
    el: "el_GR",
    fr: "fr_FR",
    de: "de_DE",
  };

  return {
    title: {
      default: "Cloudless — Cloud Computing, Serverless & AI Marketing",
      template: "%s | Cloudless",
    },
    alternates: {
      languages: {
        en: `${BASE_URL}/en`,
        el: `${BASE_URL}/el`,
        fr: `${BASE_URL}/fr`,
        de: `${BASE_URL}/de`,
        "x-default": `${BASE_URL}/en`,
      },
    },
    openGraph: {
      url: `${BASE_URL}/${locale}`,
      siteName: "Cloudless",
      locale: ogLocaleMap[locale] ?? "en_US",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Validate locale — returns 404 for unknown segments
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Enable static rendering for all locale child routes
  setRequestLocale(locale);

  // Load messages for NextIntlClientProvider
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLangSync locale={locale} />
      <AuthProvider>
        <CartProvider>
          <CookieConsentProvider>
            <GoogleAnalyticsConsent />
            {META_PIXEL_ID && <ConsentGatedPixel pixelId={META_PIXEL_ID} />}
            {LINKEDIN_PARTNER_ID && <LinkedInInsightTag />}
            <AttributionCapture />
            <JsonLd data={getOrganizationSchema()} />
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
              <ClientCartSlideOver />
            </main>
            <Footer />
            <ServiceWorkerRegistration />
            <ClientDecorators />
            <CookieConsent />
            <ClientChatWidget />
          </CookieConsentProvider>
        </CartProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
