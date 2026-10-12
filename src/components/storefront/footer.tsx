import { ArrowUp, Banknote } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getListingItemsByIds, getNewestProducts, getStorefrontNav } from "@/modules/catalog/storefront";
import { CONTENT_FALLBACKS } from "@/modules/content/schema";
import { getHomepageContent } from "@/modules/content/content.service";
import { getBestSellerIds, getPublicDeliveryInfo } from "@/modules/content/storefront-data";
import { NewsletterForm } from "./newsletter-form";
import { SocialLinks } from "./social-icons";

// Only routes that exist are linked.
const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Shop all", href: "/shop" },
  { label: "New arrivals", href: "/shop?sort=newest" },
  { label: "Shipping & returns", href: "/shipping-returns" },
  { label: "My account", href: "/account" },
  { label: "Track my orders", href: "/account/orders" },
] as const;

function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="font-display text-[0.9375rem] font-bold">{title}</h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[0.9375rem] text-white/75 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function popularProducts() {
  // Best sellers come from real orders; until something sells, the column shows the newest products instead.
  const ids = await getBestSellerIds(6);
  const best = await getListingItemsByIds(ids);
  if (best.length >= 3) return { title: "Most Purchased", items: best };
  return { title: "New Arrivals", items: await getNewestProducts(6) };
}

export async function StorefrontFooter() {
  const [categories, content, popular, delivery] = await Promise.all([getStorefrontNav(), getHomepageContent(), popularProducts(), getPublicDeliveryInfo()]);
  const marquee = content.marquee.length ? content.marquee : categories.map((c) => c.name);
  const newsletter = {
    title: content.newsletter.title || CONTENT_FALLBACKS.newsletter.title,
    body: content.newsletter.body || CONTENT_FALLBACKS.newsletter.body,
  };
  return (
    <>
      {marquee.length ? (
        <div className="overflow-hidden border-t border-black/15 bg-white py-6" aria-label={marquee.join(" · ")} role="marquee">
          <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-32 pr-32 motion-reduce:animate-none" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-32">
                {marquee.map((phrase, i) => (
                  <span key={`${copy}-${i}`} className="font-display text-3xl font-medium tracking-[-0.02em] whitespace-nowrap text-[#111] sm:text-[2.625rem]">
                    {phrase}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <footer className="mt-auto bg-[#111] text-white">
        <div className="mx-auto grid max-w-[90rem] gap-12 px-4 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.45fr] lg:px-28">
          <Column title="Quick links" links={[...quickLinks]} />
          <Column title="Collections" links={categories.slice(0, 8).map((c) => ({ label: c.name, href: `/categories/${c.slug}` }))} />
          <Column title={popular.title} links={popular.items.map((p) => ({ label: p.title, href: `/products/${p.slug}` }))} />
          <div>
            <h2 className="font-display text-[0.9375rem] font-bold">{newsletter.title}</h2>
            <p className="mt-5 max-w-md text-[0.9375rem] text-white/75">{newsletter.body}</p>
            <div className="mt-5">
              <NewsletterForm />
            </div>
            <SocialLinks
              social={content.social}
              className="mt-3 flex gap-2.5 [--social-icon-bg:#111]"
              itemClassName="flex size-8 items-center justify-center rounded-full border border-white/40 text-white/90 transition hover:border-white hover:text-white"
            />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-white/75 sm:flex-row sm:px-8 lg:px-20">
            <p>
              © {siteConfig.name}. All rights reserved.
            </p>
            {delivery.codEnabled ? (
              <p className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-white">
                <Banknote className="size-4" aria-hidden="true" /> Cash on Delivery available
              </p>
            ) : null}
            <a
              href="#top"
              className="inline-flex size-12 items-center justify-center rounded-full border border-white/30 text-white/80 transition hover:border-white hover:text-white"
              aria-label="Back to top"
            >
              <ArrowUp className="size-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
