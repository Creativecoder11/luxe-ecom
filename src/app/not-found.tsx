import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold tracking-widest text-accent uppercase">404</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for does not exist or is no longer available.
      </p>
      <Link href="/" className={`${buttonVariants()} mt-8 rounded-full`}>
        Back to home
      </Link>
    </main>
  );
}
