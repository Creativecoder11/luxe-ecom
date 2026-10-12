/**
 * URL search params ⇄ listing filters. Attribute filters use `attr_<code>=<value>` (repeatable),
 * brands `brand=<slug>`, prices in whole taka (`min`, `max`). Unknown or malformed values are dropped.
 */
import { parseMajorToMinor } from "@/lib/money";
import type { ListingFilters, ListingSort } from "./storefront";

type Params = Record<string, string | string[] | undefined>;

const SORTS: readonly ListingSort[] = ["newest", "price_asc", "price_desc"];
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

function all(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value !== undefined ? [value] : []).map((v) => v.trim()).filter(Boolean);
}

function price(value: string | string[] | undefined): number | undefined {
  const raw = all(value)[0];
  if (!raw) return undefined;
  const minor = parseMajorToMinor(raw);
  return minor !== null && minor >= 0 ? minor : undefined;
}

export function parseListingParams(params: Params): Omit<ListingFilters, "categorySlug"> {
  const attributes: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("attr_")) continue;
    const code = key.slice(5);
    if (!TOKEN.test(code)) continue;
    const values = all(value).filter((v) => TOKEN.test(v));
    if (values.length) attributes[code] = values;
  }
  const sort = all(params.sort)[0] as ListingSort | undefined;
  const page = Number(all(params.page)[0] ?? 1);
  return {
    q: all(params.q)[0]?.slice(0, 100),
    brandSlugs: all(params.brand).filter((b) => TOKEN.test(b)),
    minPriceMinor: price(params.min),
    maxPriceMinor: price(params.max),
    attributes,
    sort: sort && SORTS.includes(sort) ? sort : "newest",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Builds a query string for links (pagination, removing a filter), omitting defaults. */
export function listingQuery(filters: Omit<ListingFilters, "categorySlug">, overrides: { page?: number } = {}): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  for (const b of filters.brandSlugs ?? []) sp.append("brand", b);
  if (filters.minPriceMinor !== undefined) sp.set("min", String(filters.minPriceMinor / 100));
  if (filters.maxPriceMinor !== undefined) sp.set("max", String(filters.maxPriceMinor / 100));
  for (const [code, values] of Object.entries(filters.attributes ?? {})) for (const v of values) sp.append(`attr_${code}`, v);
  if (filters.sort && filters.sort !== "newest") sp.set("sort", filters.sort);
  const page = overrides.page ?? filters.page ?? 1;
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
