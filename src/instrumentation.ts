/**
 * Server start-up hook. Monitors event-loop delay so CPU-bound work blocking all requests
 * shows up in the logs (observability; see docs/ARCHITECTURE.md §9).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { monitorEventLoopDelay } = await import("node:perf_hooks");
  const { logger } = await import("@/lib/logging/logger");
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const timer = setInterval(() => {
    const p99 = histogram.percentile(99) / 1e6;
    const max = histogram.max / 1e6;
    if (p99 > 200) logger.warn({ p99Ms: Math.round(p99), maxMs: Math.round(max) }, "event loop delay high");
    histogram.reset();
  }, 5_000);
  timer.unref();
}
