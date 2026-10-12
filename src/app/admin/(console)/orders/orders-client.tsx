"use client";

import { Printer } from "lucide-react";
import { useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

/** GET filter form that also submits when a select, date or amount changes (Enter in text fields still works). */
export function OrderFilterForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(event) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === "date" || target.type === "number"))) {
          event.currentTarget.requestSubmit();
        }
      }}
    />
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonVariants({ variant: "outline", size: "sm" })}>
      <Printer aria-hidden="true" /> Print
    </button>
  );
}

/**
 * Tracks the row checkboxes (name="orderIds") inside the table and the header "select all" box
 * (data-select-all), and shows the selection count in the toolbar beside `actions` and `aside`.
 */
export function OrderSelection({ actions, aside, children }: { actions: ReactNode; aside: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  return (
    <div
      ref={ref}
      onChange={(event) => {
        const root = ref.current;
        const target = event.target;
        if (!root || !(target instanceof HTMLInputElement) || target.type !== "checkbox") return;
        const rows = [...root.querySelectorAll<HTMLInputElement>('input[name="orderIds"]')];
        const all = root.querySelector<HTMLInputElement>("input[data-select-all]");
        if (target.dataset.selectAll !== undefined) rows.forEach((r) => (r.checked = target.checked));
        const count = rows.filter((r) => r.checked).length;
        if (all) {
          all.checked = count > 0 && count === rows.length;
          all.indeterminate = count > 0 && count < rows.length;
        }
        setSelected(count);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted-foreground tabular-nums" aria-live="polite">{selected} selected</span>
          {actions}
        </div>
        <div className="flex items-center gap-3">{aside}</div>
      </div>
      {children}
    </div>
  );
}
