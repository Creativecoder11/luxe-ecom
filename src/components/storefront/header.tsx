import { ChevronDown, LayoutGrid, Search, Truck, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { getStorefrontBrands, getStorefrontNav, type NavCategory } from "@/modules/catalog/storefront";
import { getHomepageContent } from "@/modules/content/content.service";
import { cn } from "@/lib/utils/cn";
import { CartBadge } from "./cart-badge";
import { MobileNav } from "./mobile-nav";
import { SocialLinks } from "./social-icons";

const navLink = "inline-flex h-full items-center gap-1 text-[0.9375rem] text-white/90 transition-colors hover:text-white";
const iconLink = "relative inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10";

function Dropdown({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  // CSS-only menu: opens on hover and on keyboard focus (focus-within), works before hydration.
  return (
    <li className="group relative h-full">
      <button type="button" className={navLink} aria-haspopup="true">
        {label}
        <ChevronDown className="size-3.5 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" aria-hidden="true" />
      </button>
      <div
        className={`invisible absolute top-full left-0 z-50 pt-px opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${wide ? "w-[min(44rem,80vw)]" : "w-60"}`}
      >
        <div className="rounded-b-xl bg-white p-5 text-[#111] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]">{children}</div>
      </div>
    </li>
  );
}

function CatalogMenu({ categories }: { categories: NavCategory[] }) {
  if (categories.length === 0) return <p className="text-sm text-[#6f6c66]">No categories published yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link href={`/categories/${c.slug}`} className="font-display text-[0.9375rem] font-semibold hover:underline">
            {c.name}
          </Link>
          {c.children.length ? (
            <ul className="mt-2 space-y-1.5">
              {c.children.map((child) => (
                <li key={child.slug}>
                  <Link href={`/categories/${child.slug}`} className="text-sm text-[#5d5a55] hover:text-[#111]">
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SearchMenu() {
  return (
    <details className="group relative">
      <summary className={`${iconLink} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Search">
        <Search className="size-[1.375rem]" strokeWidth={1.8} />
      </summary>
      <form action="/search" role="search" className="absolute right-0 z-50 mt-3 w-[min(24rem,90vw)] rounded-xl bg-white p-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <div className="flex gap-2">
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search products, brands and more"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-full border border-[#dedbd6] bg-[#f6f5f3] px-4 text-sm text-[#111] focus-visible:border-[#111] focus-visible:outline-none"
          />
          <button type="submit" className="h-11 rounded-full bg-[#111] px-5 text-sm font-semibold text-white">
            Search
          </button>
        </div>
      </form>
    </details>
  );
}

export async function StorefrontHeader() {
  const [categories, brands, content] = await Promise.all([getStorefrontNav(), getStorefrontBrands(), getHomepageContent()]);
  const quick = categories.slice(0, 3);
  return (
    <header className="sticky top-0 z-40">
      {content.announcement || Object.values(content.social).some(Boolean) ? (
        <div className="bg-gradient-to-r from-[#2f7a1f] via-[#45922c] to-[#2f7a1f] text-white">
          <div className="mx-auto grid h-9 max-w-[90rem] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:px-20">
            <span />
            <p className="truncate text-center text-[0.75rem] font-medium tracking-[0.06em] uppercase sm:text-[0.8125rem]">{content.announcement}</p>
            <SocialLinks social={content.social} className="hidden items-center justify-end gap-3.5 sm:flex" itemClassName="block text-white/90 hover:text-white" />
          </div>
        </div>
      ) : null}

      <div className="bg-[#1b1b1b] text-white">
        <div className="mx-auto grid h-[3.75rem] max-w-[90rem] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:px-20">
          <div className="flex items-center gap-7">
            {/* MobileNav reads the pathname; inside Suspense it never blocks a route's static shell. */}
            <Suspense fallback={<span className="-ml-2 inline-flex size-10 lg:hidden" aria-hidden="true" />}>
              <MobileNav categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />
            </Suspense>
            <nav aria-label="Featured categories" className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {quick.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/categories/${c.slug}`} className={navLink}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <Link href="/" className="max-w-[45vw] truncate font-display text-base font-bold tracking-[0.06em] whitespace-nowrap uppercase sm:max-w-none sm:text-[1.625rem] sm:tracking-[0.08em]">
            {siteConfig.name}
          </Link>

          <nav aria-label="Account and cart" className="flex items-center justify-end gap-1">
            <SearchMenu />
            <Link href="/account" className={cn(iconLink, "hidden sm:inline-flex")} aria-label="Account">
              <User className="size-[1.375rem]" strokeWidth={1.8} />
            </Link>
            <CartBadge tone="dark" />
          </nav>
        </div>

        <nav aria-label="Primary" className="hidden border-t border-white/10 lg:block">
          <div className="mx-auto flex h-[3.125rem] max-w-[90rem] items-center justify-between px-20">
            <ul className="flex h-full items-center gap-8">
              <li className="h-full">
                <Link href="/" className={navLink}>
                  Home
                </Link>
              </li>
              <Dropdown label="Catalog" wide>
                <CatalogMenu categories={categories} />
              </Dropdown>
              <li className="h-full">
                <Link href="/shop?sort=newest" className={navLink}>
                  New arrivals
                </Link>
              </li>
              <li className="h-full">
                <Link href="/shop" className={navLink}>
                  Shop
                </Link>
              </li>
              {brands.length ? (
                <Dropdown label="Brands">
                  <ul className="space-y-2">
                    {brands.map((b) => (
                      <li key={b.slug}>
                        <Link href={`/brands/${b.slug}`} className="text-sm text-[#3d3b37] hover:text-[#111] hover:underline">
                          {b.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Dropdown>
              ) : null}
            </ul>
            <ul className="flex h-full items-center gap-8">
              <li className="h-full">
                <Link href="/shop" className={navLink}>
                  <LayoutGrid className="size-4" aria-hidden="true" /> All Categories
                </Link>
              </li>
              <li className="h-full">
                <Link href="/shipping-returns" className={navLink}>
                  <Truck className="size-4" aria-hidden="true" /> Shipping &amp; Returns
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
