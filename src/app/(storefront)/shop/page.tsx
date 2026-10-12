import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton } from "@/components/storefront/listing-skeleton";
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

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <StorefrontPageHeader title="Shop all" description="Every published product across all categories." />
      <Suspense fallback={<ListingSkeleton />}>
        <ShopListing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
