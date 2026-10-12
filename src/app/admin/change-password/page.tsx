import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/password-fields";
import { Skeleton } from "@/components/ui/display";
import { getSession, requireStaff } from "@/modules/identity/session";
import { changeStaffPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Change password" };

async function ChangePassword() {
  await requireStaff({ allowPasswordChange: true });
  const session = await getSession();
  const forced = Boolean(session?.user.mustChangePassword);
  return (
    <AuthCard
      title={forced ? "Choose a new password" : "Change password"}
      description={
        forced
          ? "Your account was given a temporary password. Choose your own before continuing."
          : "Other signed-in devices will be signed out."
      }
    >
      <ChangePasswordForm action={changeStaffPasswordAction} />
    </AuthCard>
  );
}

export default function ChangePasswordPage() {
  return (
    <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-md rounded-2xl" />}>
        <ChangePassword />
      </Suspense>
    </main>
  );
}
