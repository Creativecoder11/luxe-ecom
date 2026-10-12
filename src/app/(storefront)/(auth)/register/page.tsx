import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Skeleton } from "@/components/ui/display";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const sp = await searchParams;
  const next = safeRedirectPath(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full max-w-md rounded-2xl" />}>
      <Register searchParams={searchParams} />
    </Suspense>
  );
}
