import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/auth/password-fields";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui/display";
import { normalizeBdMobile } from "@/lib/phone";
import { requireCustomer } from "@/modules/identity/session";
import { changeCustomerPasswordAction } from "../actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

async function Profile() {
  const user = await requireCustomer("/account/profile");
  const phone = user.phone ? normalizeBdMobile(user.phone) : null;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Email: {user.email}</p>
          <ProfileForm name={user.name} phone={phone?.ok ? phone.national : ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm action={changeCustomerPasswordAction} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <Profile />
    </Suspense>
  );
}
