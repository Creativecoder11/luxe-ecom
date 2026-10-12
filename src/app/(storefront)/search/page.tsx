import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton } from "@/components/storefront/listing-skeleton";
import { ListingView } from "@/components/storefront/listing-view";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { EmptyState } from "@/components/ui/display";
import { parseListingParams } from "@/modules/catalog/listing-params";
import { getStorefrontListing } from "@/modules/catalog/storefront";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

async function SearchResults({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const filters = parseListingParams(await searchParams);
  if (!filters.q) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <EmptyState icon={<SearchX />} title="Search the store" description="Type a product name, brand or SKU in the search box." />
      </div>
    );
  }
  const listing = await getStorefrontListing(filters);
  if (!listing) return null;
  return (
    <>
      <p className="mx-auto max-w-7xl px-4 pt-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        Results for <span className="font-semibold text-foreground">“{filters.q}”</span>
      </p>
      <ListingView listing={listing} filters={filters} basePath="/search" />
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <StorefrontPageHeader title="Search" />
      <Suspense fallback={<ListingSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}
