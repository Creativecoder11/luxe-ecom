import { CartDrawer } from "@/components/storefront/cart-drawer/cart-drawer";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontHeader } from "@/components/storefront/header";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div id="top" />
      <StorefrontHeader />
      <main id="main-content" className="flex-1 overflow-x-clip">
        {children}
      </main>
      <StorefrontFooter />
      <CartDrawer />
    </>
  );
}
