import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/store/AddToCartButton";
import JsonLd from "@/components/JsonLd";
import ProductIcon from "@/components/store/ProductIcon";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format-price";
import {
  getProductByIdAsync,
  getProducts,
  getProductsByCategoryAsync,
} from "@/lib/store-products";
import { categoryColors, categoryLabels } from "@/lib/store-products-client";
import { getBreadcrumbSchema, getProductSchema } from "@/lib/structured-data";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.flatMap((product) =>
    ["en", "el", "fr"].map((locale) => ({ locale, id: product.id })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByIdAsync(id);

  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const product = await getProductByIdAsync(id);

  if (!product) notFound();

  const related = (await getProductsByCategoryAsync(product.category))
    .filter((relatedProduct) => relatedProduct.id !== product.id)
    .slice(0, 3);

  const productJsonLd = getProductSchema({
    name: product.name,
    description: product.description,
    price: product.price / 100,
    image: `https://cloudless.gr${product.image}`,
  });

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "https://cloudless.gr" },
    { name: "Store", url: "https://cloudless.gr/store" },
    { name: product.name, url: `https://cloudless.gr/store/${product.id}` },
  ]);

  return (
    <>
      <JsonLd data={[productJsonLd, breadcrumbJsonLd]} />

      <section className="bg-void-light border-neon-cyan/10 border-b">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <nav className="flex items-center gap-2 font-mono text-sm text-slate-500">
            <Link
              href="/store"
              className="hover:text-neon-cyan text-xs transition-colors"
            >
              Store
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-400">{product.name}</span>
          </nav>
        </div>
      </section>

      <section className="bg-void py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div className="neon-border bg-void-light aspect-square overflow-hidden rounded-lg">
              <ProductIcon productId={product.id} category={product.category} />
            </div>

            <div>
              <span
                className={`mb-4 inline-block rounded-full px-3 py-1 font-mono text-[10px] font-medium ${
                  categoryColors[product.category]
                }`}
              >
                {categoryLabels[product.category]}
              </span>

              <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
                {product.name}
              </h1>

              <p className="mt-4 text-lg leading-relaxed text-slate-400">
                {product.description}
              </p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-neon-cyan glow-cyan font-mono text-3xl font-bold">
                  {formatPrice(product.price, product.currency)}
                </span>
                {product.recurring && (
                  <span className="font-mono text-sm text-slate-500">
                    /{product.interval}
                  </span>
                )}
              </div>

              {product.features && product.features.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-neon-cyan/60 mb-4 font-mono text-xs font-medium tracking-[0.3em]">
                    WHAT&apos;S INCLUDED
                  </h2>
                  <ul className="space-y-3">
                    {product.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-slate-400"
                      >
                        <span className="text-neon-cyan mt-0.5 shrink-0 font-mono text-xs">
                          &#x25B8;
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8">
                <AddToCartButton product={product} />
              </div>

              <p className="mt-4 font-mono text-xs text-slate-600">
                Secure checkout powered by Stripe. 30-day money-back guarantee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-void border-t border-slate-800 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-neon-cyan/60 mb-8 font-mono text-xs font-medium tracking-[0.3em]">
              YOU MAY ALSO LIKE
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  href={`/store/${relatedProduct.id}`}
                  className="group neon-border bg-void-light/50 overflow-hidden rounded-lg transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="bg-void-lighter relative aspect-[4/3] overflow-hidden">
                    <ProductIcon
                      productId={relatedProduct.id}
                      category={relatedProduct.category}
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-heading group-hover:text-neon-cyan text-sm font-semibold text-white transition-colors">
                      {relatedProduct.name}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {relatedProduct.description}
                    </p>
                    <span className="text-neon-cyan mt-2 inline-block font-mono text-sm font-bold">
                      {formatPrice(
                        relatedProduct.price,
                        relatedProduct.currency,
                      )}
                      {relatedProduct.recurring && (
                        <span className="ml-1 font-normal text-slate-500">
                          /{relatedProduct.interval}
                        </span>
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
