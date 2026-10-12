"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};
const hasQuery = () => window.location.search.length > 1;

// Runs while the prerendered HTML is parsing (before React hydrates). Injected as markup so React
// never treats it as a script it should run on client renders.
const MARK_FILTERED = `<script>if(location.search.length>1)document.currentScript.closest("[data-listing]").setAttribute("data-filtered","")</script>`;

/**
 * Shows `children` only on a URL without a query string, otherwise `skeleton`. The inline script
 * applies the same rule on the first paint, so a filtered URL never flashes the unfiltered products.
 */
export function UnfilteredOnly({ children, skeleton }: { children: ReactNode; skeleton: ReactNode }) {
  const filtered = useSyncExternalStore(noop, hasQuery, () => false);
  return (
    <div className="group/listing" data-listing="" data-filtered={filtered ? "" : undefined} suppressHydrationWarning>
      <span hidden dangerouslySetInnerHTML={{ __html: MARK_FILTERED }} />
      <div className="group-data-[filtered]/listing:hidden">{filtered ? null : children}</div>
      <div className="hidden group-data-[filtered]/listing:block">{skeleton}</div>
    </div>
  );
}
