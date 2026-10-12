import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { listingQuery } from "@/modules/catalog/listing-params";
import type { Listing, ListingFilters } from "@/modules/catalog/storefront";
import { AutoSubmitForm } from "./auto-submit";
import { ProductGrid } from "./product-grid";

type Filters = Omit<ListingFilters, "categorySlug">;

function FilterGroup({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-border py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-subtle-foreground transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function Filters({ listing, filters, basePath }: { listing: Listing; filters: Filters; basePath: string }) {
  const selected = (code: string, value: string) => filters.attributes?.[code]?.includes(value) ?? false;
  return (
    <AutoSubmitForm action={basePath} method="get" aria-label="Filter products">
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.sort && filters.sort !== "newest" ? <input type="hidden" name="sort" value={filters.sort} /> : null}

      {listing.brands.length ? (
        <FilterGroup title="Brand">
          {listing.brands.map((b) => (
            <label key={b.slug} className="flex items-center gap-2.5 text-sm">
              <Checkbox name="brand" value={b.slug} defaultChecked={filters.brandSlugs?.includes(b.slug)} />
              <span className="flex-1">{b.name}</span>
              <span className="text-xs text-subtle-foreground">{b.count}</span>
            </label>
          ))}
        </FilterGroup>
      ) : null}

      {listing.facets.map((facet) => (
        <FilterGroup key={facet.code} title={facet.label}>
          {facet.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2.5 text-sm">
              <Checkbox name={`attr_${facet.code}`} value={o.value} defaultChecked={selected(facet.code, o.value)} />
              {o.colorHex ? (
                <span className="size-4 rounded-full border border-border-strong" style={{ backgroundColor: o.colorHex }} aria-hidden="true" />
              ) : null}
              <span className="flex-1">{o.label}</span>
              <span className="text-xs text-subtle-foreground">{o.count}</span>
            </label>
          ))}
        </FilterGroup>
      ))}

      {listing.priceRange ? (
        <FilterGroup title="Price (৳)">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="price-min">Minimum price</label>
            <Input id="price-min" name="min" inputMode="numeric" placeholder={String(Math.floor(listing.priceRange.minMinor / 100))} defaultValue={filters.minPriceMinor !== undefined ? filters.minPriceMinor / 100 : ""} className="h-9" />
            <span className="text-subtle-foreground">–</span>
            <label className="sr-only" htmlFor="price-max">Maximum price</label>
            <Input id="price-max" name="max" inputMode="numeric" placeholder={String(Math.ceil(listing.priceRange.maxMinor / 100))} defaultValue={filters.maxPriceMinor !== undefined ? filters.maxPriceMinor / 100 : ""} className="h-9" />
          </div>
        </FilterGroup>
      ) : null}

      <div className="flex gap-2 pt-4">
        <button type="submit" className={buttonVariants({ size: "sm" })}>Apply</button>
        <Link href={filters.q ? `${basePath}?q=${encodeURIComponent(filters.q)}` : basePath} className={buttonVariants({ size: "sm", variant: "ghost" })}>
          Clear
        </Link>
      </div>
    </AutoSubmitForm>
  );
}

export function ListingView({ listing, filters, basePath }: { listing: Listing; filters: Filters; basePath: string }) {
  const hasFilters = Boolean(filters.brandSlugs?.length || Object.keys(filters.attributes ?? {}).length || filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined);
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_1fr] lg:px-8">
      <aside>
        <details className="group lg:hidden" open={false}>
          <summary className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <SlidersHorizontal /> Filters{hasFilters ? " (active)" : ""}
          </summary>
          <div className="mt-2">
            <Filters listing={listing} filters={filters} basePath={basePath} />
          </div>
        </details>
        <div className="hidden lg:block">
          <Filters listing={listing} filters={filters} basePath={basePath} />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {listing.total} {listing.total === 1 ? "product" : "products"}
            {listing.priceRange ? (
              <span className="hidden sm:inline">
                {" "}· {formatMoney(listing.priceRange.minMinor, "BDT", { showDecimals: false })}–{formatMoney(listing.priceRange.maxMinor, "BDT", { showDecimals: false })}
              </span>
            ) : null}
          </p>
          <AutoSubmitForm action={basePath} method="get" className="flex items-center gap-2">
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
            {filters.brandSlugs?.map((b) => <input key={b} type="hidden" name="brand" value={b} />)}
            {Object.entries(filters.attributes ?? {}).flatMap(([code, values]) => values.map((v) => <input key={`${code}-${v}`} type="hidden" name={`attr_${code}`} value={v} />))}
            {filters.minPriceMinor !== undefined ? <input type="hidden" name="min" value={filters.minPriceMinor / 100} /> : null}
            {filters.maxPriceMinor !== undefined ? <input type="hidden" name="max" value={filters.maxPriceMinor / 100} /> : null}
            <label htmlFor="sort" className="text-sm text-muted-foreground">Sort</label>
            <Select id="sort" name="sort" defaultValue={filters.sort ?? "newest"} className="h-9 w-44">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
            <noscript>
              <button type="submit" className={buttonVariants({ size: "sm", variant: "outline" })}>Sort</button>
            </noscript>
          </AutoSubmitForm>
        </div>

        <ProductGrid items={listing.items} />

        {listing.pageCount > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2 text-sm">
            {listing.page > 1 ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${basePath}${listingQuery(filters, { page: listing.page - 1 })}`} rel="prev">
                Previous
              </Link>
            ) : null}
            <span className="px-3 text-muted-foreground">
              Page {listing.page} of {listing.pageCount}
            </span>
            {listing.page < listing.pageCount ? (
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`${basePath}${listingQuery(filters, { page: listing.page + 1 })}`} rel="next">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
