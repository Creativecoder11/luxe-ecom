import type { ReactNode } from "react";
import { ListingSkeleton } from "./listing-skeleton";
import { UnfilteredOnly } from "./unfiltered-only";

/**
 * Suspense fallback for listing pages (/shop, /categories/x, /brands/x). The listing reads search
 * params, so it always renders per request; this fallback puts the *unfiltered* listing (cached
 * catalog data) into the prerendered static shell instead of a skeleton, so a plain visit shows
 * real products straight from the CDN. When the URL has filters, the skeleton shows instead, so
 * shoppers never see the wrong products while the filtered listing streams in.
 */
export function InstantListingFallback({ children }: { children: ReactNode }) {
  return <UnfilteredOnly skeleton={<ListingSkeleton />}>{children}</UnfilteredOnly>;
}
