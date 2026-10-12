import { ShoppingCart } from "lucide-react";
import { Suspense } from "react";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { getCartItemCount } from "@/modules/cart/cart.service";
import { cn } from "@/lib/utils/cn";
import { CartTrigger } from "./cart-drawer/cart-trigger";
import { LiveCount } from "./cart-drawer/live-count";

async function Count({ tone }: { tone: "light" | "dark" }) {
  const token = await readCartToken();
  const count = token ? await getCartItemCount(await getBusinessId(), token) : 0;
  return <LiveCount serverCount={count} tone={tone} />;
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
      <Suspense fallback={<LiveCount serverCount={0} tone={tone} />}>
        <Count tone={tone} />
      </Suspense>
    </CartTrigger>
  );
}
