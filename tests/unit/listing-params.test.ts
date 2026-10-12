import { describe, expect, it } from "vitest";
import { listingQuery, parseListingParams } from "@/modules/catalog/listing-params";

describe("listing params", () => {
  it("parses filters, prices in taka and attribute filters", () => {
    expect(
      parseListingParams({ q: " serum ", brand: ["aurora-beauty", "bad slug!"], min: "500", max: "1,250.50", attr_shade: ["ruby-red", "<script>"], sort: "price_asc", page: "2" }),
    ).toEqual({
      q: "serum",
      brandSlugs: ["aurora-beauty"],
      minPriceMinor: 50_000,
      maxPriceMinor: 125_050,
      attributes: { shade: ["ruby-red"] },
      sort: "price_asc",
      page: 2,
    });
  });

  it("falls back to safe defaults for garbage", () => {
    expect(parseListingParams({ sort: "drop table", page: "-3", min: "abc", "attr_Bad Code": "x" })).toEqual({
      q: undefined,
      brandSlugs: [],
      minPriceMinor: undefined,
      maxPriceMinor: undefined,
      attributes: {},
      sort: "newest",
      page: 1,
    });
  });

  it("round-trips through listingQuery", () => {
    const filters = parseListingParams({ q: "tee", attr_size: ["m", "l"], max: "900", sort: "price_desc" });
    expect(listingQuery(filters, { page: 3 })).toBe("?q=tee&max=900&attr_size=m&attr_size=l&sort=price_desc&page=3");
    expect(parseListingParams(Object.fromEntries(new URLSearchParams("attr_size=m"))).attributes).toEqual({ size: ["m"] });
    expect(listingQuery(parseListingParams({}))).toBe("");
  });
});
