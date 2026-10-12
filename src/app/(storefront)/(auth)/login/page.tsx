import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert, Skeleton } from "@/components/ui/display";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = safeRedirectPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <AuthCard
      title="Sign in"
      description="Track orders, save addresses and check out faster."
      footer={
        <>
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {sp.reset ? (
        <Alert tone="success" className="mb-4">
          Your password was changed. Sign in with your new password.
        </Alert>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-md rounded-2xl" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
