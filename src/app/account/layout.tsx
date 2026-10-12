import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontHeader } from "@/components/storefront/header";
import { Skeleton } from "@/components/ui/display";
import { requireCustomer } from "@/modules/identity/session";
import { signOutCustomerAction } from "./actions";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

async function AccountShell({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr] lg:px-8 lg:py-12">
      <aside className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">My account</h1>
          <p className="truncate text-sm text-muted-foreground">{user.name}</p>
        </div>
        <AccountNav />
        <form action={signOutCustomerAction}>
          <button type="submit" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <>
      <StorefrontHeader />
      <main id="main-content" className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-40 w-full" />
            </div>
          }
        >
          <AccountShell>{children}</AccountShell>
        </Suspense>
      </main>
      <StorefrontFooter />
    </>
  );
}
