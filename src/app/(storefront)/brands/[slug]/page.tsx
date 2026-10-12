import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InstantListingFallback } from "@/components/storefront/instant-listing";
import { ListingView } from "@/components/storefront/listing-view";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { parseListingParams } from "@/modules/catalog/listing-params";
import { getStorefrontBrands, getStorefrontListing } from "@/modules/catalog/storefront";

/**
 * Known brands are prerendered at build and served from the CDN (ISR); catalog edits expire them via
 * CATALOG_TAG. Brands added after the build render on first visit, then stay cached.
 * Unknown slugs render the noindex not-found page (D-020).
 */
export const instant = false;

export async function generateStaticParams() {
  const brands = await getStorefrontBrands();
  return brands.length ? brands.map((b) => ({ slug: b.slug })) : [{ slug: "__none__" }];
}


async function brandName(slug: string) {
  const listing = await getStorefrontListing({ brandSlugs: [slug] });
  return listing?.brands.find((b) => b.slug === slug)?.name ?? null;
}

export async function generateMetadata({ params }: PageProps<"/brands/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const name = await brandName(slug);
  return name ? { title: name, alternates: { canonical: `/brands/${slug}` } } : { title: "Brand not found", robots: { index: false } };
}

async function BrandListing({ slug, searchParams }: { slug: string; searchParams: PageProps<"/brands/[slug]">["searchParams"] }) {
  const filters = parseListingParams(await searchParams);
  const listing = await getStorefrontListing({ ...filters, brandSlugs: [slug] });
  if (!listing) return null;
  return <ListingView listing={listing} filters={{ ...filters, brandSlugs: [slug] }} basePath={`/brands/${slug}`} />;
}

/** Unfiltered listing (cached), shown in the static shell until the per-request listing streams in. */
async function DefaultBrandListing({ slug }: { slug: string }) {
  const filters = parseListingParams({});
  const listing = await getStorefrontListing({ ...filters, brandSlugs: [slug] });
  return listing ? <ListingView listing={listing} filters={{ ...filters, brandSlugs: [slug] }} basePath={`/brands/${slug}`} /> : null;
}

export default async function BrandPage({ params, searchParams }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const name = await brandName(slug);
  if (!name) notFound();
  return (
    <>
      <StorefrontPageHeader title={name} description={`Products from ${name}.`} />
      <Suspense fallback={<InstantListingFallback><DefaultBrandListing slug={slug} /></InstantListingFallback>}>
        <BrandListing slug={slug} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
