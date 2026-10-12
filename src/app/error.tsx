"use client";

import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold sm:text-3xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We could not load this page. Please try again. If the problem continues, contact support
        {error.digest ? (
          <>
            {" "}
            and quote reference <code className="rounded bg-surface-muted px-1.5 py-0.5 text-sm">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
