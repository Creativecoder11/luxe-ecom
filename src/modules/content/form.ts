import type { Banner, ContentSection, HomepageContent } from "./schema";
import { SOCIAL_NETWORKS } from "./schema";

/** Reads one submitted field ("" when absent). */
export type FieldReader = (name: string) => string;

export const SECTION_LIMITS = { heroes: 2, promos: 4, slider: 6, tiles: 4, gallery: 10, tabs: 6, splits: 2, marquee: 6, saleTags: 4 } as const;

function readBanner(get: FieldReader, prefix: string): Banner {
  return {
    title: get(`${prefix}.title`),
    subtitle: get(`${prefix}.subtitle`),
    href: get(`${prefix}.href`),
    ctaLabel: get(`${prefix}.ctaLabel`),
    imageKey: get(`${prefix}.imageKey`) || null,
    imageAlt: get(`${prefix}.imageAlt`),
  };
}

/** A slot the owner left blank is dropped, so the storefront can fall back to catalog data. */
export function isBlankBanner(b: Banner): boolean {
  return !b.title && !b.subtitle && !b.imageKey;
}

function readBanners(get: FieldReader, prefix: string, count: number): Banner[] {
  return Array.from({ length: count }, (_, i) => readBanner(get, `${prefix}.${i}`)).filter((b) => !isBlankBanner(b));
}

function lines(value: string, max: number, separator: RegExp = /\r?\n/): string[] {
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Applies one admin form section to the current document. The caller validates the result
 * with homepageContentSchema, so this only maps field names to the document shape.
 */
export function applySection(current: HomepageContent, section: ContentSection, get: FieldReader): HomepageContent {
  const next: HomepageContent = structuredClone(current);
  switch (section) {
    case "general":
      next.announcement = get("announcement");
      next.social = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, get(`social.${n}`)])) as HomepageContent["social"];
      break;
    case "heroes":
      next.heroes = readBanners(get, "heroes", SECTION_LIMITS.heroes);
      break;
    case "promos":
      next.promos = readBanners(get, "promos", SECTION_LIMITS.promos);
      break;
    case "featured":
      next.featured = { lead: get("featured.lead"), accent: get("featured.accent"), body: get("featured.body"), categorySlug: get("featured.categorySlug") };
      break;
    case "slider":
      next.slider = readBanners(get, "slider", SECTION_LIMITS.slider);
      break;
    case "spotlight":
      next.spotlight = {
        lead: get("spotlight.lead"),
        accent: get("spotlight.accent"),
        body: get("spotlight.body"),
        categorySlug: get("spotlight.categorySlug"),
        banner: readBanner(get, "spotlight.banner"),
      };
      break;
    case "tiles":
      next.tiles = readBanners(get, "tiles", SECTION_LIMITS.tiles);
      break;
    case "gallery":
      next.gallery = {
        lead: get("gallery.lead"),
        accent: get("gallery.accent"),
        body: get("gallery.body"),
        items: readBanners(get, "gallery.items", SECTION_LIMITS.gallery),
      };
      break;
    case "tabs":
      next.tabs = {
        lead: get("tabs.lead"),
        accent: get("tabs.accent"),
        body: get("tabs.body"),
        categorySlugs: [
          ...new Set(Array.from({ length: SECTION_LIMITS.tabs }, (_, i) => get(`tabs.categorySlugs.${i}`)).filter(Boolean)),
        ],
      };
      break;
    case "feature":
      next.feature = { banner: readBanner(get, "feature.banner"), categorySlug: get("feature.categorySlug") };
      break;
    case "statement":
      next.statement = get("statement");
      next.showStats = get("showStats") === "on" || get("showStats") === "true";
      break;
    case "sale":
      next.sale = {
        couponCode: get("sale.couponCode").toUpperCase(),
        eyebrow: get("sale.eyebrow"),
        title: get("sale.title"),
        body: get("sale.body"),
        tags: lines(get("sale.tags"), SECTION_LIMITS.saleTags, /\r?\n|,/),
        ctaLabel: get("sale.ctaLabel"),
        href: get("sale.href"),
        imageKey: get("sale.imageKey") || null,
      };
      break;
    case "splits":
      next.splits = Array.from({ length: SECTION_LIMITS.splits }, (_, i) => ({
        lead: get(`splits.${i}.lead`),
        accent: get(`splits.${i}.accent`),
        body: get(`splits.${i}.body`),
        categorySlug: get(`splits.${i}.categorySlug`),
        imageKey: get(`splits.${i}.imageKey`) || null,
        imageAlt: get(`splits.${i}.imageAlt`),
      })).filter((s) => s.lead || s.accent || s.categorySlug || s.imageKey);
      break;
    case "footer":
      next.marquee = lines(get("marquee"), SECTION_LIMITS.marquee);
      next.newsletter = { title: get("newsletter.title"), body: get("newsletter.body") };
      break;
    case "policies":
      next.shippingReturns = get("shippingReturns");
      break;
  }
  return next;
}
