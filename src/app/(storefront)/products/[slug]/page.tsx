import { ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ProductGrid } from "@/components/storefront/product-grid";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { Skeleton } from "@/components/ui/display";
import { siteConfig } from "@/config/site";
import { mediaUrl } from "@/lib/media";
import { getBusinessId } from "@/modules/business/context";
import { isWishlisted } from "@/modules/cart/wishlist.service";
import { getNewestProducts, getSitemapEntries, getStorefrontProduct, type StorefrontProduct } from "@/modules/catalog/storefront";
import { getCustomerUser } from "@/modules/identity/session";
import { getVariantStock } from "@/modules/inventory/storefront-stock";

/**
 * Known products are prerendered at build and served from the CDN (ISR); catalog edits expire them via
 * CATALOG_TAG. Products added after the build render on first visit, then stay cached.
 * Unknown slugs render the noindex not-found page (D-020).
 */
export const instant = false;

/** Newest 500 products at build; the rest are rendered on first request. */
export async function generateStaticParams() {
  const { products } = await getSitemapEntries();
  return products.length ? products.slice(0, 500).map((p) => ({ slug: p.slug })) : [{ slug: "__none__" }];
}


export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const description = product.seoDescription ?? product.description.slice(0, 155);
  return {
    title: product.seoTitle ?? product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      images: product.media[0] ? [{ url: mediaUrl(product.media[0].key), alt: product.media[0].alt ?? product.title }] : undefined,
    },
  };
}

/** schema.org Product with real prices only (no availability until stock exists in Gate 3). */
function productJsonLd(product: StorefrontProduct) {
  const prices = product.variants.map((v) => v.priceMinor / 100);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.variants.length === 1 ? product.variants[0]!.sku : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    image: product.media.map((m) => mediaUrl(m.key)),
    offers:
      prices.length === 1
        ? { "@type": "Offer", price: prices[0]!.toFixed(2), priceCurrency: product.currency }
        : { "@type": "AggregateOffer", lowPrice: Math.min(...prices).toFixed(2), highPrice: Math.max(...prices).toFixed(2), priceCurrency: product.currency, offerCount: prices.length },
  };
}

/** Live stock and wishlist state are per-request; the product data itself is cached. */
async function PurchasePanel({ product }: { product: StorefrontProduct }) {
  const [stock, user] = await Promise.all([
    getVariantStock(await getBusinessId(), product.variants.map((v) => v.id)),
    getCustomerUser(),
  ]);
  const wishlisted = user ? await isWishlisted(user.id, product.id) : false;
  return (
    <VariantPicker
      axes={product.axes}
      variants={product.variants}
      currency={product.currency}
      productId={product.id}
      slug={product.slug}
      stock={stock}
      wishlisted={wishlisted}
    />
  );
}

async function Related({ product }: { product: StorefrontProduct }) {
  const category = product.lineage.at(-1)?.slug;
  const items = await getNewestProducts(4, product.id, category);
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-6 text-2xl font-bold">You may also like</h2>
      <ProductGrid items={items} currency={product.currency} />
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) notFound();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap gap-1.5">
            <li><Link href="/shop" className="hover:text-foreground">Shop</Link></li>
            {product.lineage.map((c) => (
              <li key={c.slug} className="flex gap-1.5">
                <span aria-hidden="true">/</span>
                <Link href={`/categories/${c.slug}`} className="hover:text-foreground">{c.name}</Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="grid min-w-0 gap-3 self-start">
            {product.media.length ? (
              product.media.map((m, i) => (
                <Image
                  key={m.key}
                  src={mediaUrl(m.key)}
                  alt={m.alt ?? product.title}
                  width={m.width ?? 1200}
                  height={m.height ?? 1200}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className="h-auto w-full rounded-xl bg-surface-muted object-cover"
                />
              ))
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-muted text-subtle-foreground">
                <ImageOff className="size-10" aria-hidden="true" />
                <span className="sr-only">No product image</span>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.brand ? (
              <Link href={`/brands/${product.brand.slug}`} className="text-xs font-semibold tracking-wider text-accent uppercase hover:underline">
                {product.brand.name}
              </Link>
            ) : null}
            <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">{product.title}</h1>
            <div className="mt-6">
              <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
                <PurchasePanel product={product} />
              </Suspense>
            </div>

            {product.specs.length ? (
              <section className="mt-10" aria-labelledby="specs-heading">
                <h2 id="specs-heading" className="text-lg font-semibold">Details</h2>
                <dl className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {product.specs.map((s) => (
                    <div key={s.label} className="grid grid-cols-[9rem_1fr] gap-4 px-4 py-3 text-sm">
                      <dt className="text-muted-foreground">{s.label}</dt>
                      <dd className="font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {product.description ? (
              <section className="mt-8" aria-labelledby="description-heading">
                <h2 id="description-heading" className="text-lg font-semibold">Description</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</div>
              </section>
            ) : null}

            {product.returnPolicyNote ? (
              <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">{product.returnPolicyNote}</p>
            ) : null}
            <p className="mt-6 text-xs text-subtle-foreground">Sold by {siteConfig.name}.</p>
          </div>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mx-auto h-72 max-w-7xl" />}>
        <Related product={product} />
      </Suspense>
    </>
  );
}
