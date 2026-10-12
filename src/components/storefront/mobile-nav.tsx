"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteConfig, storefrontNav } from "@/config/site";

interface MobileNavProps {
  categories: { name: string; slug: string }[];
}

const accountLinks = [
  { label: "My account", href: "/account" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Cart", href: "/cart" },
] as const;

export function MobileNav({ categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Close the drawer whenever navigation completes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10 lg:hidden"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-0 h-dvh max-h-dvh w-[min(22rem,88vw)] max-w-none bg-surface p-0 text-foreground backdrop:bg-black/40"
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="font-display text-lg font-extrabold">{siteConfig.name}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <form action="/search" role="search" className="border-b border-border p-4">
          <label htmlFor="mobile-search" className="sr-only">
            Search products
          </label>
          <input
            id="mobile-search"
            name="q"
            type="search"
            placeholder="Search products"
            className="h-11 w-full rounded-full border border-border bg-surface-muted px-4 text-sm focus-visible:border-ring focus-visible:outline-none"
          />
        </form>

        <nav aria-label="Mobile primary" className="p-2">
          <ul className="space-y-0.5">
            {storefrontNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-md px-3 py-3 text-base font-medium hover:bg-surface-muted">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {categories.length ? (
            <>
              <p className="mt-4 px-3 text-xs font-semibold tracking-wider text-subtle-foreground uppercase">Categories</p>
              <ul className="mt-1 space-y-0.5">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/categories/${c.slug}`} className="block rounded-md px-3 py-3 text-base hover:bg-surface-muted">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-4 px-3 text-xs font-semibold tracking-wider text-subtle-foreground uppercase">Your account</p>
          <ul className="mt-1 space-y-0.5">
            {accountLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-md px-3 py-3 text-base hover:bg-surface-muted">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
