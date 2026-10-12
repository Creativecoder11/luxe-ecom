/**
 * Storefront identity and presentation defaults. Business-editable values move to
 * BusinessSettings / CMS in Gates 2 and 7; until then they come from public env or these defaults.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_STORE_NAME || "Luxe",
  tagline: "Beauty, fashion, gadgets and everyday living, all in one place.",
  locale: "en",
  currency: "BDT",
  hero: {
    eyebrow: "New season edit",
    title: "Thoughtfully chosen for the way you live",
    body: "Discover skincare, style, gadgets and home essentials, curated in one place and delivered to your door.",
    primaryCta: { label: "Shop all products", href: "/shop" },
    secondaryCta: { label: "Search the store", href: "/search" },
  },
  /** Optional strip above the header; null hides it. Configured by the business, never invented. */
  announcement: null as string | null,
} as const;

export const storefrontNav = [
  { label: "Home", href: "/" },
  { label: "Shop all", href: "/shop" },
  { label: "New arrivals", href: "/shop?sort=newest" },
  { label: "Shipping & returns", href: "/shipping-returns" },
] as const;
