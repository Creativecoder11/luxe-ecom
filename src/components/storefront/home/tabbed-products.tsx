"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface ProductTab {
  key: string;
  label: string;
  /** Rendered on the server: an avatar (product image or category icon). */
  avatar: ReactNode;
  panel: ReactNode;
}

/** Category tabs (circular avatars) that switch between pre-rendered product rails. */
export function TabbedProducts({ heading, tabs }: { heading: ReactNode; tabs: ProductTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const id = useId();
  return (
    <div>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {heading}
        <div role="tablist" aria-label="Categories" className="flex gap-5 overflow-x-auto pb-1 sm:gap-7">
          {tabs.map((tab) => {
            const selected = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`${id}-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`${id}-panel-${tab.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.key)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  const index = tabs.findIndex((t) => t.key === active);
                  const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
                  setActive(next.key);
                  document.getElementById(`${id}-tab-${next.key}`)?.focus();
                }}
                className="group flex shrink-0 flex-col items-center gap-2.5"
              >
                <span
                  className={cn(
                    "flex size-[4.75rem] items-center justify-center overflow-hidden rounded-full border-2 p-1 transition-colors",
                    selected ? "border-[#111]" : "border-[#c9c7c3] group-hover:border-[#8d8a85]",
                  )}
                >
                  <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-[#ecebe8] text-[#3b3936]">{tab.avatar}</span>
                </span>
                <span className={cn("text-[0.9375rem]", selected ? "font-semibold text-[#111]" : "text-[#6f6c66]")}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`${id}-panel-${tab.key}`} aria-labelledby={`${id}-tab-${tab.key}`} hidden={tab.key !== active} className="mt-8">
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
