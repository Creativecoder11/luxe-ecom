import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/display";
import { maskPhone } from "@/lib/phone";
import { requireCustomer } from "@/modules/identity/session";

const sections = [
  { title: "My orders", description: "Track your orders and see their details.", href: "/account/orders" },
  { title: "Wishlist", description: "Products you saved for later.", href: "/account/wishlist" },
  { title: "Profile", description: "Your name, mobile number and password.", href: "/account/profile" },
];

async function Overview() {
  const user = await requireCustomer();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user.name}</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mobile</dt>
              <dd className="mt-0.5 font-medium">{user.phone ? maskPhone(user.phone) : "Not set"}</dd>
            </div>
          </dl>
          <Link href="/account/profile" className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">
            Edit profile
          </Link>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((tile) => (
          <Link key={tile.title} href={tile.href} className="block rounded-xl transition-shadow hover:shadow-raised">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{tile.title}</CardTitle>
                <CardDescription>{tile.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AccountOverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <Overview />
    </Suspense>
  );
}
