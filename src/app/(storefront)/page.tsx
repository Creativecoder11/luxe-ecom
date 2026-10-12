import { siteConfig } from "@/config/site";
import {
  BannerSlider,
  CategoryStrip,
  CategoryTabs,
  describeDiscount,
  FeatureBanner,
  FeaturedProducts,
  Gallery,
  HeroBanners,
  ImageTiles,
  PromoCards,
  SaleBanner,
  Spotlight,
  SplitShowcase,
  StatementAndStats,
  type ResolvedBanner,
} from "@/components/storefront/home/sections";
import { getListingItemsByIds, getNewestProducts, getStorefrontNav, type NavCategory } from "@/modules/catalog/storefront";
import { getHomepageContent } from "@/modules/content/content.service";
import { CONTENT_FALLBACKS, type Banner } from "@/modules/content/schema";
import { getBestSellerIds, getSaleCampaign, getStoreStats } from "@/modules/content/storefront-data";

/**
 * Homepage. Section text and images come from Admin → Homepage settings; anything the owner
 * has not filled in falls back to real catalog data (category names, published products).
 * No figures, reviews or stock photos are invented.
 */

function categoryBanner(c: NavCategory): ResolvedBanner {
  return {
    title: c.name,
    subtitle: c.children.map((ch) => ch.name).join(" · "),
    href: `/categories/${c.slug}`,
    ctaLabel: "Shop Now",
    imageKey: null,
    imageAlt: "",
  };
}

function resolve(banner: Banner, fallback: ResolvedBanner): ResolvedBanner {
  return {
    title: banner.title || fallback.title,
    subtitle: banner.subtitle || (banner.title ? "" : fallback.subtitle),
    href: banner.href || fallback.href,
    ctaLabel: banner.ctaLabel || fallback.ctaLabel,
    imageKey: banner.imageKey ?? null,
    imageAlt: banner.imageAlt || banner.title || fallback.title,
  };
}

/** Configured banners, or category banners when the owner has not set any. */
function bannersOr(configured: Banner[], categories: NavCategory[], count: number, offset = 0): ResolvedBanner[] {
  const fallbacks = categories.length ? [...categories.slice(offset), ...categories.slice(0, offset)].map(categoryBanner) : [];
  if (configured.length) return configured.map((b, i) => resolve(b, fallbacks[i % Math.max(1, fallbacks.length)] ?? shopBanner()));
  return fallbacks.slice(0, count);
}

function shopBanner(title = "Shop the collection", subtitle: string = siteConfig.tagline): ResolvedBanner {
  return { title, subtitle, href: "/shop", ctaLabel: "Shop Now", imageKey: null, imageAlt: "" };
}

async function productsFor(slug: string | undefined, limit: number) {
  return getNewestProducts(limit, undefined, slug || undefined);
}

export default async function HomePage() {
  const [content, categories] = await Promise.all([getHomepageContent(), getStorefrontNav()]);

  const flatCategories = categories.flatMap((c) => (c.children.length ? [c, ...c.children] : [c])).slice(0, 12);
  const heroes = content.heroes.length
    ? content.heroes.map((b, i) => resolve(b, i === 0 ? shopBanner(siteConfig.name) : categories[0] ? categoryBanner(categories[0]) : shopBanner()))
    : [shopBanner("Everything You Love, Delivered", siteConfig.tagline), categories[0] ? categoryBanner(categories[0]) : shopBanner("New This Season", "Fresh arrivals across every category.")];

  const tabSlugs = content.tabs.categorySlugs.length ? content.tabs.categorySlugs : categories.slice(0, 4).map((c) => c.slug);
  const splitSources = content.splits.length
    ? content.splits
    : categories.slice(0, 2).map((c) => ({ lead: c.name, accent: "", body: c.children.map((ch) => ch.name).join(" · "), categorySlug: c.slug, imageKey: null, imageAlt: "" }));

  const [featured, spotlightItems, featureItems, tabItems, splitItems, stats, campaign, bestIds] = await Promise.all([
    productsFor(content.featured.categorySlug, 10),
    productsFor(content.spotlight.categorySlug, 5),
    productsFor(content.feature.categorySlug, 10),
    Promise.all(tabSlugs.map((slug) => productsFor(slug, 10))),
    Promise.all(splitSources.map((s) => productsFor(s.categorySlug, 4))),
    content.showStats ? getStoreStats() : Promise.resolve(null),
    getSaleCampaign(content.sale.couponCode),
    content.spotlight.categorySlug ? Promise.resolve([] as string[]) : getBestSellerIds(5),
  ]);
  // Without a chosen category, the spotlight shows real best sellers (falling back to newest).
  const best = await getListingItemsByIds(bestIds);
  const spotlightList = best.length >= 3 ? best : spotlightItems;

  // Owner items: uploaded image → photo tile, no image → text card. Fallback mirrors the reference
  // layout: text cards in slots 3 and 6, toned tiles elsewhere.
  const galleryItems: ResolvedBanner[] = content.gallery.items.length
    ? content.gallery.items.map((b, i) => ({
        ...resolve(b, categories[i % Math.max(1, categories.length)] ? categoryBanner(categories[i % categories.length]!) : shopBanner()),
        textCard: !b.imageKey,
      }))
    : flatCategories.slice(0, 10).map((c, i) => ({
        ...categoryBanner({ name: c.name, slug: c.slug, children: [] }),
        subtitle: `Explore ${c.name.toLowerCase()} picked for everyday living.`,
        textCard: i === 3 || i === 6,
      }));

  const tabs = tabSlugs
    .map((slug, i) => ({ slug, name: flatCategories.find((c) => c.slug === slug)?.name ?? categories.find((c) => c.slug === slug)?.name ?? slug, items: tabItems[i] ?? [] }))
    .filter((t) => t.items.length > 0);

  const spotlightBanner = resolve(content.spotlight.banner, shopBanner("Everyday Made Easy", "Discover practical products that bring better performance, effortless convenience and modern style."));
  const featureBanner = resolve(content.feature.banner, shopBanner("Upgrade Your Lifestyle", "Smarter everyday essentials designed to make every moment easier, faster and more connected."));

  return (
    <>
      <HeroBanners banners={heroes} />
      <PromoCards banners={bannersOr(content.promos, categories, 4)} />
      <CategoryStrip categories={flatCategories} />
      <FeaturedProducts
        lead={content.featured.lead || CONTENT_FALLBACKS.featured.lead}
        accent={content.featured.accent || (content.featured.lead ? "" : CONTENT_FALLBACKS.featured.accent)}
        items={featured}
      />
      <BannerSlider banners={bannersOr(content.slider, categories, 6, 1)} />
      <Spotlight
        lead={content.spotlight.lead || CONTENT_FALLBACKS.spotlight.lead}
        accent={content.spotlight.accent || (content.spotlight.lead ? "" : CONTENT_FALLBACKS.spotlight.accent)}
        banner={spotlightBanner}
        items={spotlightList}
      />
      <ImageTiles banners={bannersOr(content.tiles, categories, 4, 2)} />
      <Gallery
        lead={content.gallery.lead || CONTENT_FALLBACKS.gallery.lead}
        accent={content.gallery.accent || (content.gallery.lead ? "" : CONTENT_FALLBACKS.gallery.accent)}
        body={content.gallery.body || (content.gallery.lead ? "" : CONTENT_FALLBACKS.gallery.body)}
        items={galleryItems}
      />
      <CategoryTabs
        lead={content.tabs.lead || CONTENT_FALLBACKS.tabs.lead}
        accent={content.tabs.accent || (content.tabs.lead ? "" : CONTENT_FALLBACKS.tabs.accent)}
        tabs={tabs}
      />
      <FeatureBanner banner={featureBanner} items={featureItems} />
      <StatementAndStats statement={content.statement || siteConfig.tagline} stats={stats} />
      {campaign ? (
        <SaleBanner
          campaign={campaign}
          eyebrow={content.sale.eyebrow}
          title={content.sale.title || `Save ${describeDiscount(campaign)}`}
          body={content.sale.body}
          tags={content.sale.tags}
          ctaLabel={content.sale.ctaLabel}
          href={content.sale.href}
          imageKey={content.sale.imageKey}
        />
      ) : null}
      {splitSources.map((s, i) =>
        (splitItems[i] ?? []).length ? (
          <SplitShowcase key={i} index={i} lead={s.lead} accent={s.accent} body={s.body} imageKey={s.imageKey} imageAlt={s.imageAlt} items={splitItems[i]!} />
        ) : null,
      )}
    </>
  );
}
