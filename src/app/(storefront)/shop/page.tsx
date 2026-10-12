import type { Metadata } from "next";
import { Suspense } from "react";
import { InstantListingFallback } from "@/components/storefront/instant-listing";
import { ListingView } from "@/components/storefront/listing-view";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { parseListingParams } from "@/modules/catalog/listing-params";
import { getStorefrontListing } from "@/modules/catalog/storefront";

export const metadata: Metadata = { title: "Shop all", alternates: { canonical: "/shop" } };

async function ShopListing({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const filters = parseListingParams(await searchParams);
  const listing = await getStorefrontListing(filters);
  if (!listing) return null;
  return <ListingView listing={listing} filters={filters} basePath="/shop" />;
}

/** Unfiltered listing from cached data: part of the static shell, so /shop shows products instantly. */
async function DefaultShopListing() {
  const filters = parseListingParams({});
  const listing = await getStorefrontListing(filters);
  return listing ? <ListingView listing={listing} filters={filters} basePath="/shop" /> : null;
}

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <StorefrontPageHeader title="Shop all" description="Every published product across all categories." />
      <Suspense fallback={<InstantListingFallback><DefaultShopListing /></InstantListingFallback>}>
        <ShopListing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
