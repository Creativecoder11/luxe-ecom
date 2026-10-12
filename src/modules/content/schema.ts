import { z } from "zod";

/**
 * Homepage content document (D-035). Every field has a default, so a missing or partially
 * stored document always parses; sections left empty fall back to real catalog data
 * (categories, products) when rendered, never to invented figures or stock photos.
 */

const text = (max: number) => z.string().trim().max(max).default("");

/** Internal path ("/shop", "/categories/x") or an absolute https URL. */
export const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), {
    message: "Use a path such as /shop or a full https:// address.",
  })
  .default("");

/** Storage key of an uploaded ContentMedia image (checked against the table before saving). */
const imageKey = z
  .string()
  .regex(/^content\/[a-z0-9]{2}\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/)
  .nullable()
  .default(null);

export const bannerSchema = z.object({
  title: text(120),
  subtitle: text(240),
  href: linkSchema,
  ctaLabel: text(40),
  imageKey,
  imageAlt: text(160),
});
export type Banner = z.infer<typeof bannerSchema>;

const heading = z.object({ lead: text(80), accent: text(80), body: text(300) });

const categorySlug = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-z0-9-]*$/, "Pick a category from the list.")
  .default("");

export const SOCIAL_NETWORKS = ["facebook", "instagram", "youtube", "tiktok", "linkedin", "x"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const homepageContentSchema = z.object({
  announcement: text(160),
  social: z.object(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, linkSchema])) as Record<SocialNetwork, typeof linkSchema>).default(
    Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, ""])) as Record<SocialNetwork, string>,
  ),
  heroes: z.array(bannerSchema).max(2).default([]),
  promos: z.array(bannerSchema).max(4).default([]),
  featured: heading.extend({ categorySlug }).default({ lead: "", accent: "", body: "", categorySlug: "" }),
  slider: z.array(bannerSchema).max(6).default([]),
  spotlight: heading.extend({ categorySlug, banner: bannerSchema.default(bannerSchema.parse({})) }).default({
    lead: "",
    accent: "",
    body: "",
    categorySlug: "",
    banner: bannerSchema.parse({}),
  }),
  tiles: z.array(bannerSchema).max(4).default([]),
  gallery: heading.extend({ items: z.array(bannerSchema).max(10).default([]) }).default({ lead: "", accent: "", body: "", items: [] }),
  tabs: heading.extend({ categorySlugs: z.array(categorySlug).max(6).default([]) }).default({ lead: "", accent: "", body: "", categorySlugs: [] }),
  feature: z.object({ banner: bannerSchema.default(bannerSchema.parse({})), categorySlug }).default({ banner: bannerSchema.parse({}), categorySlug: "" }),
  statement: text(400),
  showStats: z.boolean().default(true),
  sale: z
    .object({ couponCode: text(40), eyebrow: text(60), title: text(120), body: text(200), tags: z.array(text(40)).max(4).default([]), ctaLabel: text(40), href: linkSchema, imageKey })
    .default({ couponCode: "", eyebrow: "", title: "", body: "", tags: [], ctaLabel: "", href: "", imageKey: null }),
  splits: z.array(heading.extend({ categorySlug, imageKey, imageAlt: text(160) })).max(2).default([]),
  marquee: z.array(text(60)).max(6).default([]),
  newsletter: z.object({ title: text(80), body: text(200) }).default({ title: "", body: "" }),
  shippingReturns: text(4000),
});

export type HomepageContent = z.infer<typeof homepageContentSchema>;

/** Parses a stored document; anything unreadable falls back to defaults rather than breaking the storefront. */
export function parseHomepageContent(raw: unknown): HomepageContent {
  const result = homepageContentSchema.safeParse(raw ?? {});
  return result.success ? result.data : homepageContentSchema.parse({});
}

/** Copy used when the owner has not written their own. Neutral, category-agnostic and free of claims. */
export const CONTENT_FALLBACKS = {
  featured: { lead: "Everyday Essentials for", accent: "Modern Living" },
  spotlight: { lead: "Innovation for Your", accent: "Modern Lifestyle" },
  gallery: { lead: "Thoughtful Picks", accent: "for Home", body: "From everyday convenience to small luxuries, explore products chosen for modern living." },
  tabs: { lead: "Popular Picks", accent: "for Everyday Comfort" },
  statement: "",
  newsletter: { title: "Get Updates in Your Inbox", body: "Get the latest news, new arrivals and offers from Luxe." },
  marquee: [] as string[],
} as const;

export const CONTENT_SECTIONS = [
  "general",
  "heroes",
  "promos",
  "featured",
  "slider",
  "spotlight",
  "tiles",
  "gallery",
  "tabs",
  "feature",
  "statement",
  "sale",
  "splits",
  "footer",
  "policies",
] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

/** Every image key a document references (used to validate saves and to clean up replaced files). */
export function contentImageKeys(content: HomepageContent): string[] {
  const banners = [
    ...content.heroes,
    ...content.promos,
    ...content.slider,
    content.spotlight.banner,
    ...content.tiles,
    ...content.gallery.items,
    content.feature.banner,
  ];
  return [
    ...banners.map((b) => b.imageKey),
    content.sale.imageKey,
    ...content.splits.map((s) => s.imageKey),
  ].filter((k): k is string => Boolean(k));
}
