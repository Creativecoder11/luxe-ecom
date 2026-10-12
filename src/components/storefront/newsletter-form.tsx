"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { subscribeAction } from "@/app/(storefront)/newsletter-actions";
import { echoed } from "@/lib/action-result";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 shrink-0 rounded-full border border-white/70 bg-[#111] px-6 text-sm font-semibold tracking-wide text-white uppercase transition hover:bg-white hover:text-[#111] disabled:opacity-60"
    >
      {pending ? "Saving…" : "Subscribe"}
    </button>
  );
}

export function NewsletterForm() {
  const [state, action] = useActionState(subscribeAction, null);
  const error = state && !state.ok ? (state.fieldErrors?.email ?? state.error) : null;
  return (
    <form action={action} className="space-y-2" noValidate>
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Email address"
          defaultValue={echoed(state, "email")}
          aria-invalid={error ? true : undefined}
          aria-describedby="newsletter-status"
          className="h-12 min-w-0 flex-1 rounded-full bg-[#262626] px-5 text-sm text-white placeholder:text-white/55 focus-visible:outline-2 focus-visible:outline-white"
        />
        <Submit />
      </div>
      <p id="newsletter-status" role="status" className="min-h-5 text-xs text-white/70">
        {state?.ok ? state.message : error}
      </p>
    </form>
  );
}
