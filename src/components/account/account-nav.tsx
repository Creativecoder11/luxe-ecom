"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountSections } from "@/config/modules";
import { cn } from "@/lib/utils/cn";

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {accountSections.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
