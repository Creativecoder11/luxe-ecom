import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { formatDateTime } from "@/lib/format";
import { getContentEditorOptions, getHomepageContentForAdmin } from "@/modules/content/content.service";
import { SECTION_LIMITS } from "@/modules/content/form";
import { SOCIAL_NETWORKS } from "@/modules/content/schema";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { BannerFields, CategorySelect, ImageInput, SectionForm, TextInput, type CategoryOption } from "./editor";

export const metadata: Metadata = { title: "Homepage settings" };

const SOCIAL_LABELS: Record<(typeof SOCIAL_NETWORKS)[number], string> = {
  facebook: "Facebook page",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
};

const SECTION_NAV = [
  ["general", "Announcement & social"],
  ["heroes", "Hero banners"],
  ["promos", "Promo cards"],
  ["featured", "Featured products"],
  ["slider", "Banner slider"],
  ["spotlight", "Spotlight"],
  ["tiles", "Image tiles"],
  ["gallery", "Gallery"],
  ["tabs", "Category tabs"],
  ["feature", "Feature banner"],
  ["statement", "Statement & figures"],
  ["sale", "Sale countdown"],
  ["splits", "Showcases"],
  ["footer", "Marquee & newsletter"],
  ["policies", "Shipping & returns"],
] as const;

async function HomepageSettings() {
  const actor = await requireStaff();
  if (!can(actor, "content.manage")) return <AccessDenied permission="content.manage" />;
  const [{ content: c, updatedAt }, options] = await Promise.all([getHomepageContentForAdmin(actor), getContentEditorOptions(actor)]);
  const categories: CategoryOption[] = options.categories;
  const coupons = options.coupons;
  const slots = (n: number) => Array.from({ length: n }, (_, i) => i);

  return (
    <>
      <AdminPageHeader
        title="Homepage settings"
        description={
          <>
            Banners, text and images on the storefront homepage. Empty slots fall back to your categories and newest products.
            {updatedAt ? ` Last saved ${formatDateTime(updatedAt)}.` : " Nothing has been saved yet."}
          </>
        }
        actions={
          <Link href="/" target="_blank" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink className="size-4" aria-hidden="true" /> View homepage
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[13rem_1fr]">
        <nav aria-label="Sections" className="hidden xl:block">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTION_NAV.map(([key, label]) => (
              <li key={key}>
                <a href={`#section-${key}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <SectionForm section="general" title="Announcement & social" description="The green bar above the header and the social icons in the header and footer.">
            <TextInput name="announcement" label="Announcement" defaultValue={c.announcement} maxLength={160} hint="Leave empty to hide the bar. Only state offers you actually provide." />
            <div className="grid gap-4 md:grid-cols-2">
              {SOCIAL_NETWORKS.map((n) => (
                <TextInput key={n} name={`social.${n}`} label={SOCIAL_LABELS[n]} defaultValue={c.social[n]} placeholder="https://" maxLength={300} />
              ))}
            </div>
          </SectionForm>

          <SectionForm section="heroes" title="Hero banners" description="The two large banners at the top of the page.">
            {slots(SECTION_LIMITS.heroes).map((i) => (
              <BannerFields key={i} prefix={`heroes.${i}`} banner={c.heroes[i]} heading={`Banner ${i + 1}`} />
            ))}
          </SectionForm>

          <SectionForm section="promos" title="Promo cards" description="Four cards below the hero. Empty: your first four categories.">
            {slots(SECTION_LIMITS.promos).map((i) => (
              <BannerFields key={i} prefix={`promos.${i}`} banner={c.promos[i]} heading={`Card ${i + 1}`} />
            ))}
          </SectionForm>

          <SectionForm section="featured" title="Featured products" description="Heading and product grid after the category icons.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="featured.lead" label="Heading" defaultValue={c.featured.lead} placeholder="Everyday Essentials for" maxLength={80} />
              <TextInput name="featured.accent" label="Highlighted words" defaultValue={c.featured.accent} placeholder="Modern Living" maxLength={80} />
            </div>
            <CategorySelect name="featured.categorySlug" label="Products from" defaultValue={c.featured.categorySlug} categories={categories} />
          </SectionForm>

          <SectionForm section="slider" title="Banner slider" description="Up to six wide slides. Empty: your categories.">
            {slots(SECTION_LIMITS.slider).map((i) => (
              <BannerFields key={i} prefix={`slider.${i}`} banner={c.slider[i]} heading={`Slide ${i + 1}`} withCta={false} />
            ))}
          </SectionForm>

          <SectionForm section="spotlight" title="Spotlight" description="Large image with a list of products beside it. Without a category, best sellers (or newest) are listed.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="spotlight.lead" label="Heading" defaultValue={c.spotlight.lead} placeholder="Innovation for Your" maxLength={80} />
              <TextInput name="spotlight.accent" label="Heading (second part)" defaultValue={c.spotlight.accent} placeholder="Modern Lifestyle" maxLength={80} />
            </div>
            <CategorySelect name="spotlight.categorySlug" label="Products from" defaultValue={c.spotlight.categorySlug} categories={categories} />
            <BannerFields prefix="spotlight.banner" banner={c.spotlight.banner} heading="Image card" withCta={false} />
          </SectionForm>

          <SectionForm section="tiles" title="Image tiles" description="Four full-height tiles across the page.">
            {slots(SECTION_LIMITS.tiles).map((i) => (
              <BannerFields key={i} prefix={`tiles.${i}`} banner={c.tiles[i]} heading={`Tile ${i + 1}`} withCta={false} withSubtitle={false} />
            ))}
          </SectionForm>

          <SectionForm section="gallery" title="Gallery" description="Masonry grid of up to ten blocks. A block with an image is a photo; without one it becomes a dark text card.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="gallery.lead" label="Heading" defaultValue={c.gallery.lead} placeholder="Thoughtful Picks" maxLength={80} />
              <TextInput name="gallery.accent" label="Highlighted words" defaultValue={c.gallery.accent} placeholder="for Home" maxLength={80} />
            </div>
            <TextInput name="gallery.body" label="Intro text" defaultValue={c.gallery.body} maxLength={300} />
            {slots(SECTION_LIMITS.gallery).map((i) => (
              <BannerFields key={i} prefix={`gallery.items.${i}`} banner={c.gallery.items[i]} heading={`Block ${i + 1}`} withCta={false} />
            ))}
          </SectionForm>

          <SectionForm section="tabs" title="Category tabs" description="Round category tabs with a product carousel. Empty: your top-level categories.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="tabs.lead" label="Heading" defaultValue={c.tabs.lead} placeholder="Popular Picks" maxLength={80} />
              <TextInput name="tabs.accent" label="Highlighted words" defaultValue={c.tabs.accent} placeholder="for Everyday Comfort" maxLength={80} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {slots(SECTION_LIMITS.tabs).map((i) => (
                <Field key={i} id={`tabs-${i}`} label={`Tab ${i + 1}`}>
                  {(aria) => (
                    <Select {...aria} name={`tabs.categorySlugs.${i}`} defaultValue={c.tabs.categorySlugs[i] ?? ""}>
                      <option value="">—</option>
                      {categories.map((cat) => (
                        <option key={cat.slug} value={cat.slug}>
                          {cat.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}
            </div>
          </SectionForm>

          <SectionForm section="feature" title="Feature banner" description="Full-width banner with a strip of products along the bottom.">
            <BannerFields prefix="feature.banner" banner={c.feature.banner} />
            <CategorySelect name="feature.categorySlug" label="Products from" defaultValue={c.feature.categorySlug} categories={categories} />
          </SectionForm>

          <SectionForm section="statement" title="Statement & figures" description="A large brand statement, then store figures computed from your real orders and catalog.">
            <TextInput name="statement" label="Statement" defaultValue={c.statement} multiline maxLength={400} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="showStats" defaultChecked={c.showStats} className="mt-0.5 size-4 accent-primary" />
              <span>
                Show store figures (customers served, products available, repeat customers). Figures that are zero are hidden automatically.
              </span>
            </label>
          </SectionForm>

          <SectionForm section="sale" title="Sale countdown" description="Shown only while the chosen coupon is active and has an end date in the future. The countdown uses that end date.">
            <Field id="sale-coupon" label="Coupon">
              {(aria) => (
                <Select {...aria} name="sale.couponCode" defaultValue={c.sale.couponCode}>
                  <option value="">No countdown</option>
                  {coupons.map((cp) => (
                    <option key={cp.code} value={cp.code}>
                      {cp.code}
                      {cp.endsAt ? ` (ends ${formatDateTime(cp.endsAt)})` : " (no end date — will not show)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="sale.eyebrow" label="Small heading" defaultValue={c.sale.eyebrow} maxLength={60} />
              <TextInput name="sale.title" label="Title" defaultValue={c.sale.title} hint="Empty: built from the coupon's real discount." maxLength={120} />
              <TextInput name="sale.body" label="Text" defaultValue={c.sale.body} maxLength={200} />
              <TextInput name="sale.tags" label="Tags" defaultValue={c.sale.tags.join(", ")} hint="Up to four, separated by commas." maxLength={200} />
              <TextInput name="sale.ctaLabel" label="Button text" defaultValue={c.sale.ctaLabel} placeholder="Shop now" maxLength={40} />
              <TextInput name="sale.href" label="Button link" defaultValue={c.sale.href} placeholder="/shop" maxLength={300} />
            </div>
            <ImageInput name="sale.imageKey" label="Background image" defaultKey={c.sale.imageKey} />
          </SectionForm>

          <SectionForm section="splits" title="Showcases" description="Two half-image, half-product sections near the bottom. Empty: your first two categories.">
            {slots(SECTION_LIMITS.splits).map((i) => {
              const s = c.splits[i];
              return (
                <fieldset key={i} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
                  <legend className="px-1 text-sm font-semibold">Showcase {i + 1}</legend>
                  <TextInput name={`splits.${i}.lead`} label="Heading" defaultValue={s?.lead} maxLength={80} />
                  <TextInput name={`splits.${i}.accent`} label="Highlighted words" defaultValue={s?.accent} maxLength={80} />
                  <TextInput name={`splits.${i}.body`} label="Text" defaultValue={s?.body} maxLength={300} />
                  <CategorySelect name={`splits.${i}.categorySlug`} label="Products from" defaultValue={s?.categorySlug} categories={categories} />
                  <ImageInput name={`splits.${i}.imageKey`} label="Image" defaultKey={s?.imageKey ?? null} />
                  <TextInput name={`splits.${i}.imageAlt`} label="Image description" defaultValue={s?.imageAlt} maxLength={160} />
                </fieldset>
              );
            })}
          </SectionForm>

          <SectionForm section="footer" title="Marquee & newsletter" description="The scrolling phrases above the footer and the newsletter box.">
            <TextInput name="marquee" label="Marquee phrases" defaultValue={c.marquee.join("\n")} multiline hint="One phrase per line, up to six. Empty: your category names." />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput name="newsletter.title" label="Newsletter heading" defaultValue={c.newsletter.title} placeholder="Get Updates in Your Inbox" maxLength={80} />
              <TextInput name="newsletter.body" label="Newsletter text" defaultValue={c.newsletter.body} maxLength={200} />
            </div>
          </SectionForm>

          <SectionForm section="policies" title="Shipping & returns" description="Your returns policy, shown on the Shipping & returns page beneath the delivery fees from Settings.">
            <TextInput name="shippingReturns" label="Returns policy" defaultValue={c.shippingReturns} multiline maxLength={4000} />
          </SectionForm>
        </div>
      </div>
    </>
  );
}

export default function HomepageSettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <HomepageSettings />
    </Suspense>
  );
}
