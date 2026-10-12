import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InstantListingFallback } from "@/components/storefront/instant-listing";
import { ListingView } from "@/components/storefront/listing-view";
import { parseListingParams } from "@/modules/catalog/listing-params";
import { getSitemapEntries, getStorefrontListing } from "@/modules/catalog/storefront";

/**
 * Known categories are prerendered at build and served from the CDN (ISR); catalog edits expire them via
 * CATALOG_TAG. Categories added after the build render on first visit, then stay cached.
 * Unknown slugs render the noindex not-found page (D-020).
 */
export const instant = false;

export async function generateStaticParams() {
  const { categories } = await getSitemapEntries();
  return categories.length ? categories.map((slug) => ({ slug })) : [{ slug: "__none__" }];
}


export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getStorefrontListing({ categorySlug: slug });
  if (!listing?.category) return { title: "Category not found", robots: { index: false } };
  return {
    title: listing.category.name,
    description: listing.category.description ?? `Shop ${listing.category.name}.`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

async function CategoryListing({ slug, searchParams }: { slug: string; searchParams: PageProps<"/categories/[slug]">["searchParams"] }) {
  const filters = parseListingParams(await searchParams);
  const listing = await getStorefrontListing({ ...filters, categorySlug: slug });
  if (!listing) return null;
  return <ListingView listing={listing} filters={filters} basePath={`/categories/${slug}`} />;
}

/** Unfiltered listing (cached), shown in the static shell until the per-request listing streams in. */
async function DefaultCategoryListing({ slug }: { slug: string }) {
  const filters = parseListingParams({});
  const listing = await getStorefrontListing({ ...filters, categorySlug: slug });
  return listing ? <ListingView listing={listing} filters={filters} basePath={`/categories/${slug}`} /> : null;
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  // Existence check before anything streams so unknown categories get a real 404 (D-020).
  const listing = await getStorefrontListing({ categorySlug: slug });
  if (!listing?.category) notFound();
  const { category } = listing;

  return (
    <>
      <div className="border-b border-border bg-surface-muted">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex flex-wrap gap-1.5">
              <li><Link href="/shop" className="hover:text-foreground">Shop</Link></li>
              {category.lineage.map((c, i) => (
                <li key={c.slug} className="flex gap-1.5">
                  <span aria-hidden="true">/</span>
                  {i === category.lineage.length - 1 ? (
                    <span aria-current="page" className="text-foreground">{c.name}</span>
                  ) : (
                    <Link href={`/categories/${c.slug}`} className="hover:text-foreground">{c.name}</Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{category.name}</h1>
          {category.description ? <p className="mt-2 max-w-2xl text-muted-foreground">{category.description}</p> : null}
        </div>
      </div>
      <Suspense fallback={<InstantListingFallback><DefaultCategoryListing slug={slug} /></InstantListingFallback>}>
        <CategoryListing slug={slug} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
