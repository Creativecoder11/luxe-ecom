import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Image from "next/image";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils/cn";
import type { ListingItem } from "@/modules/catalog/storefront";
import type { SaleCampaign, StoreStats } from "@/modules/content/storefront-data";
import { compactCount } from "@/modules/reports/definitions";
import { CategoryIcon } from "../category-icon";
import { Price, ProductCard, ProductImage, Swatches, toCardData } from "../product-card";
import { Carousel } from "./carousel";
import { ContentImage } from "./content-image";
import { Countdown } from "./countdown";
import { GradientHeading } from "./gradient-heading";
import { TabbedProducts } from "./tabbed-products";

/** A banner after fallbacks are applied: always has a title and a destination. */
export interface ResolvedBanner {
  title: string;
  subtitle: string;
  href: string;
  ctaLabel: string;
  imageKey: string | null;
  imageAlt: string;
  /** Render as a dark text card instead of an image tile (gallery). */
  textCard?: boolean;
}

export const container = "mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-[5.3rem]";

function BannerLink({ banner, className, children }: { banner: ResolvedBanner; className?: string; children: ReactNode }) {
  const external = banner.href.startsWith("http");
  return external ? (
    <a href={banner.href} className={className} rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link href={banner.href} className={className}>
      {children}
    </Link>
  );
}

const scrim = "absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent";

export function HeroBanners({ banners }: { banners: ResolvedBanner[] }) {
  return (
    <section aria-label="Featured" className="grid gap-1.5 p-1.5 md:grid-cols-2">
      {banners.map((b, i) => (
        <BannerLink key={i} banner={b} className="group relative isolate flex min-h-[22rem] items-end overflow-hidden rounded-[0.625rem] md:aspect-[2/1] md:min-h-0">
          <ContentImage imageKey={b.imageKey} alt={b.imageAlt} index={i} priority className="-z-10 transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className={cn(scrim, "-z-10")} />
          <div className="max-w-md p-6 text-white sm:p-9">
            {i === 0 ? (
              <h1 className="font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">{b.title}</h1>
            ) : (
              <h2 className="font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">{b.title}</h2>
            )}
            {b.subtitle ? <p className="mt-3 max-w-[17rem] text-[0.9375rem] leading-snug text-white/90">{b.subtitle}</p> : null}
            {b.ctaLabel ? <span className="mt-5 inline-block text-[0.9375rem] font-medium underline underline-offset-4">{b.ctaLabel}</span> : null}
          </div>
        </BannerLink>
      ))}
    </section>
  );
}

export function PromoCards({ banners }: { banners: ResolvedBanner[] }) {
  return (
    <section aria-label="Collections" className="grid grid-cols-1 gap-1.5 px-1.5 pb-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {banners.map((b, i) => (
        <BannerLink key={i} banner={b} className="group relative isolate flex aspect-[1.83] items-center overflow-hidden rounded-[0.625rem]">
          <ContentImage imageKey={b.imageKey} alt={b.imageAlt} index={i + 2} sizes="(min-width: 1024px) 25vw, 50vw" className="-z-10 transition-transform duration-700 group-hover:scale-[1.04]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/45 to-transparent" />
          <div className="max-w-[16rem] p-6 text-white sm:p-9">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{b.title}</h2>
            {b.subtitle ? <p className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-snug text-white/90">{b.subtitle}</p> : null}
            <span className="mt-5 inline-block text-[0.9375rem] font-medium underline underline-offset-4">{b.ctaLabel || "Shop Now"}</span>
          </div>
        </BannerLink>
      ))}
    </section>
  );
}

export function CategoryStrip({ categories }: { categories: { name: string; slug: string }[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Shop by category" className="bg-[#f3f3f3]">
      <ul className="mx-auto flex max-w-[90rem] overflow-x-auto py-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c, i) => (
          <li key={c.slug} className={cn("min-w-28 flex-1", i > 0 && "border-l border-black/10")}>
            <Link href={`/categories/${c.slug}`} className="group flex flex-col items-center gap-4 px-3 py-1 text-center">
              <CategoryIcon slug={c.slug} name={c.name} className="size-10 text-[#222] transition-transform group-hover:-translate-y-0.5" />
              <span className="text-[0.9375rem] text-[#111]">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FeaturedProducts({ lead, accent, items }: { lead: string; accent: string; items: ListingItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-[#f5f5f5] py-14 lg:py-16">
      <div className={container}>
        <GradientHeading lead={lead} accent={accent} />
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <li key={item.id}>
              <ProductCard product={toCardData(item)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BannerSlider({ banners }: { banners: ResolvedBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="bg-[#f3f3f3] pb-5">
      <Carousel label="Featured collections" trackClassName="gap-5 px-[7.5%] md:px-[20%]" arrows="sides" arrowInset="inside" startAt={banners.length > 2 ? 1 : 0}>
        {banners.map((b, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-center md:w-[60%]">
            <BannerLink banner={b} className="group relative isolate flex aspect-[4/3] items-end overflow-hidden rounded-xl sm:aspect-[856/493]">
              <ContentImage imageKey={b.imageKey} alt={b.imageAlt} index={i + 1} sizes="(min-width: 768px) 40vw, 85vw" className="-z-10 transition-transform duration-700 group-hover:scale-[1.03]" />
              <div className={cn(scrim, "-z-10")} />
              <div className="max-w-xl p-6 text-white sm:p-7">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-[2.125rem]">{b.title}</h2>
                {b.subtitle ? <p className="mt-2 max-w-sm text-[0.9375rem] leading-snug text-white/90">{b.subtitle}</p> : null}
              </div>
            </BannerLink>
          </li>
        ))}
      </Carousel>
    </div>
  );
}

function ProductRow({ item }: { item: ListingItem }) {
  const card = toCardData(item);
  return (
    <li className="group relative flex items-center gap-5 rounded-xl bg-white p-2.5 pr-5 shadow-[0_1px_3px_rgb(0_0_0/0.08)]">
      <ProductImage src={card.imageUrl} alt={card.imageAlt ?? card.title} className="size-[5.625rem] shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="truncate text-[0.9375rem] text-[#111]">{item.title}</h3>
        <Price product={card} />
        <Swatches swatches={item.swatches} className="pt-1" />
      </div>
      <Link
        href={card.href}
        className="shrink-0 rounded-full bg-[#111] px-4 py-2.5 text-[0.6875rem] font-semibold tracking-wide text-white uppercase transition after:absolute after:inset-0 hover:bg-[#333]"
      >
        View<span className="sr-only"> {item.title}</span>
      </Link>
    </li>
  );
}

export function Spotlight({ lead, accent, banner, items }: { lead: string; accent: string; banner: ResolvedBanner; items: ListingItem[] }) {
  return (
    <section className="bg-[#e8e8e8] py-16 lg:py-20">
      <div className={container}>
        <h2 className="mx-auto max-w-3xl text-center font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-[#8c1a1d] sm:text-5xl lg:text-[3.5rem]">
          {lead} {accent}
        </h2>
        <div className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-24">
          <BannerLink banner={banner} className="group relative isolate flex aspect-[4/5] items-end justify-center overflow-hidden rounded-3xl lg:aspect-[615/850]">
            <ContentImage imageKey={banner.imageKey} alt={banner.imageAlt} index={2} className="-z-10 transition-transform duration-700 group-hover:scale-[1.03]" />
            <div className={cn(scrim, "-z-10")} />
            <div className="max-w-md px-6 pb-12 text-center text-white">
              <h3 className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[3.25rem]">{banner.title}</h3>
              {banner.subtitle ? <p className="mt-4 text-[0.9375rem] leading-snug text-white/90">{banner.subtitle}</p> : null}
            </div>
          </BannerLink>
          {items.length ? (
            <ul className="space-y-4 lg:max-w-[29.5rem]">
              {items.map((item) => (
                <ProductRow key={item.id} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ImageTiles({ banners }: { banners: ResolvedBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <section aria-label="Explore" className="grid grid-cols-2 lg:grid-cols-4">
      {banners.map((b, i) => (
        <BannerLink key={i} banner={b} className="group relative isolate flex h-72 items-end overflow-hidden sm:h-[30rem] lg:h-[46.875rem]">
          <ContentImage imageKey={b.imageKey} alt={b.imageAlt} index={i + 3} sizes="(min-width: 1024px) 25vw, 50vw" className="-z-10 transition-transform duration-700 group-hover:scale-[1.03]" />
          <div className={cn(scrim, "-z-10")} />
          <h2 className="p-5 font-display text-xl font-semibold tracking-[-0.02em] text-white sm:p-6 sm:text-[1.75rem]">{b.title}</h2>
        </BannerLink>
      ))}
    </section>
  );
}

/** Desktop masonry: five columns of two blocks each, matching the reference proportions. */
const MASONRY_HEIGHTS = [
  ["h-[18.8rem]", "h-[20.25rem]"],
  ["h-[26rem]", "h-[13.1rem]"],
  ["h-[18.8rem]", "h-[20.25rem]"],
  ["h-[11.7rem]", "h-[27.3rem]"],
  ["h-[18.8rem]", "h-[20.25rem]"],
] as const;

function GalleryBlock({ banner, index, className }: { banner: ResolvedBanner; index: number; className?: string }) {
  if (banner.textCard) {
    return (
      <BannerLink banner={banner} className={cn("group flex flex-col rounded-xl bg-[#0d0d0d] p-7 text-white", className)}>
        <h3 className="font-display text-xl leading-tight font-semibold tracking-[-0.02em] sm:text-[1.375rem]">{banner.title}</h3>
        {banner.subtitle ? <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-white/80">{banner.subtitle}</p> : null}
        <ArrowRight className="mt-auto size-5 opacity-70 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </BannerLink>
    );
  }
  return (
    <BannerLink banner={banner} className={cn("group relative isolate block overflow-hidden rounded-xl", className)}>
      <ContentImage imageKey={banner.imageKey} alt={banner.imageAlt} index={index} sizes="(min-width: 1024px) 30vw, 50vw" className="-z-10 transition-transform duration-700 group-hover:scale-[1.04]" />
      {banner.imageKey ? (
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#111] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {banner.title}
        </span>
      ) : (
        <span className="absolute bottom-5 left-5 font-display text-lg font-semibold text-white">{banner.title}</span>
      )}
    </BannerLink>
  );
}

export function Gallery({ lead, accent, body, items }: { lead: string; accent: string; body: string; items: ResolvedBanner[] }) {
  if (items.length < 4) return null;
  const blocks = items.slice(0, 10);
  return (
    <section className="bg-white py-16 lg:py-14">
      <div className={container}>
        <div className="mx-auto max-w-2xl text-center">
          <GradientHeading lead={lead} accent={accent} breakLine />
          {body ? <p className="mt-6 text-[0.9375rem] text-[#111]">{body}</p> : null}
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3.5 lg:hidden">
          {blocks.map((b, i) => (
            <li key={i}>
              <GalleryBlock banner={b} index={i} className="aspect-square h-auto" />
            </li>
          ))}
        </ul>
        <div className="mt-8 hidden grid-cols-[1fr_1fr_2.07fr_1fr_1fr] gap-3.5 lg:grid">
          {MASONRY_HEIGHTS.map((heights, col) => (
            <ul key={col} className="flex flex-col gap-3.5">
              {heights.map((h, row) => {
                const index = col * 2 + row;
                const banner = blocks[index];
                return banner ? (
                  <li key={row}>
                    <GalleryBlock banner={banner} index={index} className={h} />
                  </li>
                ) : null;
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductRail({ items, label }: { items: ListingItem[]; label: string }) {
  return (
    <Carousel label={label} arrows="sides" trackClassName="gap-5">
      {items.map((item) => (
        <li key={item.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-5rem)/5)]">
          <ProductCard product={toCardData(item)} />
        </li>
      ))}
    </Carousel>
  );
}

export function CategoryTabs({ lead, accent, tabs }: { lead: string; accent: string; tabs: { name: string; slug: string; items: ListingItem[] }[] }) {
  if (tabs.length === 0) return null;
  return (
    <section className="bg-white pt-10 pb-6 lg:pt-14">
      <div className={container}>
        <TabbedProducts
          heading={<GradientHeading lead={lead} accent={accent} breakLine />}
          tabs={tabs.map((t) => ({
            key: t.slug,
            label: t.name,
            avatar: t.items[0]?.imageKey ? (
              <Image src={mediaUrl(t.items[0].imageKey)} alt="" width={64} height={64} sizes="64px" className="size-full object-cover" />
            ) : (
              <CategoryIcon slug={t.slug} name={t.name} className="size-7" />
            ),
            panel: <ProductRail items={t.items} label={t.name} />,
          }))}
        />
      </div>
    </section>
  );
}

export function FeatureBanner({ banner, items }: { banner: ResolvedBanner; items: ListingItem[] }) {
  return (
    <section className="relative isolate flex min-h-[38rem] flex-col justify-between overflow-hidden lg:min-h-[46.875rem]">
      <ContentImage imageKey={banner.imageKey} alt={banner.imageAlt} index={0} sizes="100vw" className="-z-10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/10 to-black/30" />
      <div className={cn(container, "pt-12 text-white lg:px-24")}>
        <h2 className="font-display text-4xl font-semibold tracking-[-0.035em] sm:text-[3.5rem]">{banner.title}</h2>
        {banner.subtitle ? <p className="mt-5 max-w-xl text-[0.9375rem] leading-snug text-white/90">{banner.subtitle}</p> : null}
        <BannerLink banner={banner} className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-6 text-[0.9375rem] font-medium text-[#111] uppercase transition hover:bg-white/85">
          {banner.ctaLabel || "Shop now"}
        </BannerLink>
      </div>
      {items.length ? (
        <div className="pb-8 pl-4 sm:pl-8 lg:pl-[5.3rem]">
          <Carousel label="Products in this collection" arrows="top-right" trackClassName="gap-2.5 pr-4" className="[&>div]:pr-24">
            {items.map((item) => {
              const card = toCardData(item);
              return (
                <li key={item.id} className="w-64 shrink-0 snap-start sm:w-[14.25rem]">
                  <Link href={card.href} className="flex h-20 items-center gap-3 rounded-lg bg-white p-2.5 pr-4 text-[#111] transition hover:shadow-lg">
                    <ProductImage src={card.imageUrl} alt={card.imageAlt ?? card.title} className="size-[3.75rem] shrink-0 rounded-md" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm leading-snug text-[#333]">{item.title}</span>
                      <Price product={{ ...card, compareAtMinor: null }} className="text-sm" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </Carousel>
        </div>
      ) : null}
    </section>
  );
}

export function StatementAndStats({ statement, stats }: { statement: string; stats: StoreStats | null }) {
  const figures = stats
    ? [
        stats.customersServed > 0 && { value: compactCount(stats.customersServed), label: "Customers served", body: "Customers who have received an order from us." },
        stats.productsAvailable > 0 && { value: compactCount(stats.productsAvailable), label: "Products available", body: "Products you can order today." },
        Boolean(stats.repeatCustomerPercent) && { value: `${stats.repeatCustomerPercent}%`, label: "Repeat customers", body: "Customers who came back to order again." },
      ].filter((f): f is { value: string; label: string; body: string } => Boolean(f))
    : [];
  if (!statement && figures.length === 0) return null;
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className={container}>
        {statement ? (
          <p className="mx-auto max-w-[62rem] text-center font-display text-3xl leading-[1.1] font-medium tracking-[-0.035em] text-balance text-[#111] sm:text-5xl lg:text-[3.5rem]">
            {statement}
          </p>
        ) : null}
        {figures.length ? (
          <dl className={cn("mt-10 grid divide-black/15 sm:divide-x", figures.length === 3 ? "sm:grid-cols-3" : figures.length === 2 ? "sm:grid-cols-2" : "")}>
            {figures.map((f, i) => (
              <div key={f.label} className="relative flex flex-col items-center px-6 py-6 text-center">
                {i === 0 && figures.length === 3 ? <Star className="absolute top-6 left-2 hidden size-16 text-[#163d2e] lg:block" strokeWidth={1.3} aria-hidden="true" /> : null}
                <dd className="order-1 font-display text-6xl leading-none font-medium tracking-[-0.04em] text-[#111] sm:text-[5.5rem]">{f.value}</dd>
                <dt className="order-2 mt-4 font-display text-lg font-bold tracking-[-0.02em] text-[#111] uppercase sm:text-xl">{f.label}</dt>
                <dd className="order-3 mt-2 max-w-xs text-[0.9375rem] text-[#111]">{f.body}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

export function SaleBanner({
  campaign,
  eyebrow,
  title,
  body,
  tags,
  ctaLabel,
  href,
  imageKey,
}: {
  campaign: SaleCampaign;
  eyebrow: string;
  title: string;
  body: string;
  tags: string[];
  ctaLabel: string;
  href: string;
  imageKey: string | null;
}) {
  return (
    <section className={cn(container, "pb-12")} aria-label="Current offer">
      <div className="relative isolate overflow-hidden rounded-2xl bg-[#4a4a4a] text-white">
        {imageKey ? <ContentImage imageKey={imageKey} sizes="100vw" className="-z-10 opacity-40" /> : null}
        <div className="grid items-center gap-8 px-6 py-10 sm:px-12 lg:grid-cols-[1fr_auto_1fr]">
          <div>
            {eyebrow ? <p className="text-[0.9375rem] tracking-wide uppercase">{eyebrow}</p> : null}
            <h2 className="mt-2 max-w-sm font-display text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.03em]">{title}</h2>
          </div>
          <div>
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <Countdown endsAt={campaign.endsAt} />
            </div>
            {tags.length ? (
              <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
                {tags.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-white" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-5 lg:items-end lg:text-right">
            <p className="max-w-xs text-[0.9375rem]">
              {body} Use code <strong className="font-semibold tracking-wide">{campaign.code}</strong> at checkout.
            </p>
            <Link href={href || "/shop"} className="inline-flex h-11 items-center rounded-full bg-[#111] px-6 text-[0.9375rem] font-medium uppercase transition hover:bg-black/80">
              {ctaLabel || "Shop now"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Formats the coupon's real discount for the sale banner copy. */
export function describeDiscount(campaign: SaleCampaign): string {
  if (campaign.freeShipping) return "free delivery";
  if (campaign.percent !== null) return `${campaign.percent}% off`;
  if (campaign.amountMinor !== null) return `${formatMoney(campaign.amountMinor, "BDT")} off`;
  return "a discount";
}

export function SplitShowcase({
  lead,
  accent,
  body,
  imageKey,
  imageAlt,
  items,
  index,
}: {
  lead: string;
  accent: string;
  body: string;
  imageKey: string | null;
  imageAlt: string;
  items: ListingItem[];
  index: number;
}) {
  return (
    <section className="grid grid-cols-1 bg-[#f5f5f5] lg:grid-cols-2">
      <div className="relative h-72 overflow-hidden bg-[#f2efec] sm:h-[28rem] lg:sticky lg:top-0 lg:h-screen">
        {imageKey ? <ContentImage imageKey={imageKey} alt={imageAlt} index={index} /> : null}
      </div>
      <div className="px-4 py-14 sm:px-8 lg:px-20 lg:py-16">
        <div className="mx-auto max-w-[35rem] text-center">
          <GradientHeading lead={lead} accent={accent} breakLine />
          {body ? <p className="mx-auto mt-6 max-w-md text-[0.9375rem] text-[#111]">{body}</p> : null}
        </div>
        <ul className="mx-auto mt-8 grid max-w-[35rem] grid-cols-2 gap-x-5 gap-y-10">
          {items.map((item) => (
            <li key={item.id}>
              <ProductCard product={toCardData(item)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
