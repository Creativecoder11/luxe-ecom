"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const arrowButton =
  "inline-flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#111] shadow-[0_2px_10px_rgb(0_0_0/0.12)] transition hover:scale-105 disabled:pointer-events-none disabled:opacity-40";

/**
 * Horizontally scrolling list with previous/next buttons. Works without JavaScript as a plain
 * scrollable row (scroll-snap); the buttons only add paging.
 */
export function Carousel({
  label,
  children,
  className,
  trackClassName,
  arrows = "sides",
  arrowInset = "outside",
  startAt = 0,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  /** "sides": vertically centred at the edges; "top-right": a pair above the track. */
  arrows?: "sides" | "top-right" | "none";
  /** "outside" places side arrows beyond a padded container; "inside" keeps them within full-bleed tracks. */
  arrowInset?: "outside" | "inside";
  /** Item to centre on first render (e.g. 1 so the previous slide peeks in from the left). */
  startAt?: number;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = track.current;
    const item = el?.children[startAt] as HTMLElement | undefined;
    if (!el || !item || startAt === 0) return;
    el.scrollLeft = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
  }, [startAt]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  const pair = (
    <>
      <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label={`Previous: ${label}`} className={arrowButton}>
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label={`Next: ${label}`} className={arrowButton}>
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </>
  );

  return (
    <section aria-roledescription="carousel" aria-label={label} className={cn("relative", className)}>
      {arrows === "top-right" ? <div className="mb-3 flex justify-end gap-2">{pair}</div> : null}
      <ul
        ref={track}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden",
          trackClassName,
        )}
      >
        {children}
      </ul>
      {arrows === "sides" ? <SideArrows onPage={page} edges={edges} label={label} inset={arrowInset} /> : null}
    </section>
  );
}

function SideArrows({
  onPage,
  edges,
  label,
  inset,
}: {
  onPage: (d: 1 | -1) => void;
  edges: { start: boolean; end: boolean };
  label: string;
  inset: "outside" | "inside";
}) {
  return (
    <div className={cn("pointer-events-none absolute top-1/2 hidden -translate-y-1/2 justify-between sm:flex", inset === "inside" ? "inset-x-6 lg:inset-x-10" : "inset-x-2 xl:-inset-x-12")}>
      <button type="button" onClick={() => onPage(-1)} disabled={edges.start} aria-label={`Previous: ${label}`} className={cn(arrowButton, "pointer-events-auto")}>
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onPage(1)} disabled={edges.end} aria-label={`Next: ${label}`} className={cn(arrowButton, "pointer-events-auto")}>
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
