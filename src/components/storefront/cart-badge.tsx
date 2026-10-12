import { ShoppingCart } from "lucide-react";
import { Suspense } from "react";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { getCartItemCount } from "@/modules/cart/cart.service";
import { cn } from "@/lib/utils/cn";
import { CartTrigger } from "./cart-drawer/cart-trigger";

async function Count({ tone }: { tone: "light" | "dark" }) {
  const token = await readCartToken();
  if (!token) return null;
  const count = await getCartItemCount(await getBusinessId(), token);
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] font-semibold",
        tone === "dark" ? "bg-white text-[#111]" : "bg-primary text-primary-foreground",
      )}
      aria-label={`${count} items in cart`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Cart link with a live item count (cookie read inside Suspense keeps pages prerenderable). */
export function CartBadge({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <CartTrigger
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full transition-colors",
        tone === "dark" ? "text-white hover:bg-white/10" : "text-foreground hover:bg-surface-muted",
      )}
    >
      <ShoppingCart className="size-[1.375rem]" strokeWidth={1.8} />
      <Suspense fallback={null}>
        <Count tone={tone} />
      </Suspense>
    </CartTrigger>
  );
}
