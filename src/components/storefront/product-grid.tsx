import { PackageOpen } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/display";
import type { ListingItem } from "@/modules/catalog/storefront";
import { cn } from "@/lib/utils/cn";
import { ProductCard, toCardData } from "./product-card";

const COLUMNS = {
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  2: "grid-cols-2",
} as const;

export function ProductGrid({
  items,
  currency = "BDT",
  empty,
  columns = 4,
}: {
  items: ListingItem[];
  currency?: string;
  empty?: ReactNode;
  columns?: keyof typeof COLUMNS;
}) {
  if (items.length === 0) {
    return <>{empty ?? <EmptyState icon={<PackageOpen />} title="No products found" description="Try removing a filter or searching for something else." />}</>;
  }
  return (
    <ul className={cn("grid gap-x-4 gap-y-9 sm:gap-x-5", COLUMNS[columns])}>
      {items.map((item) => (
        <li key={item.id}>
          <ProductCard product={toCardData(item, currency)} />
        </li>
      ))}
    </ul>
  );
}
