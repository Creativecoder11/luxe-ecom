import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListingSkeleton } from "@/components/storefront/listing-skeleton";
import { ListingView } from "@/components/storefront/listing-view";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { parseListingParams } from "@/modules/catalog/listing-params";
import { getStorefrontListing } from "@/modules/catalog/storefront";

/**
 * Per-request route (no generateStaticParams): data is cached with "use cache" and products published
 * after the build work immediately. Unknown slugs render the noindex not-found page (D-020).
 */
export const instant = false;


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

export default async function BrandPage({ params, searchParams }: PageProps<"/brands/[slug]">) {
  const { slug } = await params;
  const name = await brandName(slug);
  if (!name) notFound();
  return (
    <>
      <StorefrontPageHeader title={name} description={`Products from ${name}.`} />
      <Suspense fallback={<ListingSkeleton />}>
        <BrandListing slug={slug} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
