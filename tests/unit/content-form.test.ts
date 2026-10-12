import { describe, expect, it } from "vitest";
import { applySection } from "@/modules/content/form";
import { contentImageKeys, homepageContentSchema, parseHomepageContent } from "@/modules/content/schema";

const empty = parseHomepageContent(null);
const reader = (fields: Record<string, string>) => (name: string) => fields[name] ?? "";

describe("homepage content schema", () => {
  it("parses missing or corrupt documents to defaults", () => {
    expect(parseHomepageContent(undefined).heroes).toEqual([]);
    expect(parseHomepageContent({ heroes: "nope" }).announcement).toBe("");
  });

  it("rejects unsafe links and foreign image keys", () => {
    const bad = homepageContentSchema.safeParse({ heroes: [{ title: "x", href: "javascript:alert(1)" }] });
    expect(bad.success).toBe(false);
    expect(homepageContentSchema.safeParse({ heroes: [{ title: "x", href: "//evil.example" }] }).success).toBe(false);
    expect(homepageContentSchema.safeParse({ heroes: [{ title: "x", imageKey: "products/ab/x.jpg" }] }).success).toBe(false);
    expect(homepageContentSchema.safeParse({ heroes: [{ title: "x", href: "https://example.com/a", imageKey: "content/ab/Abc_-1.webp" }] }).success).toBe(true);
  });
});

describe("applySection", () => {
  it("drops blank banner slots so the storefront can fall back to categories", () => {
    const next = applySection(empty, "promos", reader({ "promos.1.title": "Beauty", "promos.1.href": "/categories/beauty" }));
    expect(next.promos).toHaveLength(1);
    expect(next.promos[0]).toMatchObject({ title: "Beauty", href: "/categories/beauty", imageKey: null });
  });

  it("only changes the submitted section", () => {
    const withAnnouncement = applySection(empty, "general", reader({ announcement: "Hello" }));
    const next = applySection(withAnnouncement, "statement", reader({ statement: "Hi", showStats: "on" }));
    expect(next.announcement).toBe("Hello");
    expect(next.statement).toBe("Hi");
    expect(next.showStats).toBe(true);
  });

  it("splits sale tags by comma and marquee by line, with limits", () => {
    const sale = applySection(empty, "sale", reader({ "sale.couponCode": "season15", "sale.tags": "A, B,C,D,E" }));
    expect(sale.sale.couponCode).toBe("SEASON15");
    expect(sale.sale.tags).toEqual(["A", "B", "C", "D"]);
    const footer = applySection(empty, "footer", reader({ marquee: "One, two\nThree\n\n" }));
    expect(footer.marquee).toEqual(["One, two", "Three"]);
  });

  it("de-duplicates tab categories", () => {
    const next = applySection(empty, "tabs", reader({ "tabs.categorySlugs.0": "beauty", "tabs.categorySlugs.1": "beauty", "tabs.categorySlugs.2": "home" }));
    expect(next.tabs.categorySlugs).toEqual(["beauty", "home"]);
  });

  it("collects every referenced image key", () => {
    const next = applySection(empty, "heroes", reader({ "heroes.0.title": "A", "heroes.0.imageKey": "content/ab/one.jpg" }));
    expect(contentImageKeys(next)).toEqual(["content/ab/one.jpg"]);
  });
});
