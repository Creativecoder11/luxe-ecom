"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { Days: Math.floor(total / 86400), Hours: Math.floor((total % 86400) / 3600), Minutes: Math.floor((total % 3600) / 60), Seconds: total % 60 };
}

/** Counts down to the coupon's real end time; renders nothing once it has passed. */
export function Countdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Start on the client only: the server render cannot know the visitor's clock.
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now !== null && now >= end) return <p className="px-6 py-4 text-sm text-white/80">This offer has ended.</p>;
  const p = parts(now === null ? 0 : end - now);
  return (
    <dl className="grid grid-cols-4 gap-2 text-center" aria-live="off" aria-label={`Offer ends ${new Date(endsAt).toUTCString()}`}>
      {(Object.keys(p) as (keyof typeof p)[]).map((unit) => (
        <div key={unit} className="min-w-16 px-2 py-1">
          <dd className="font-display text-3xl font-medium tabular-nums sm:text-[2.25rem]">{now === null ? "--" : String(p[unit]).padStart(2, "0")}</dd>
          <dt className="mt-1 text-xs text-white/80">{unit}</dt>
        </div>
      ))}
    </dl>
  );
}
