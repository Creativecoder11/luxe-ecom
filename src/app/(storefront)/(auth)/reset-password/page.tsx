import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert, Skeleton } from "@/components/ui/display";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

async function Reset({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";
  return (
    <AuthCard title="Choose a new password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="danger">
          This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.
        </Alert>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-md rounded-2xl" />}>
      <Reset searchParams={searchParams} />
    </Suspense>
  );
}
