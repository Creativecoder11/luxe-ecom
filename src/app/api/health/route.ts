import { connection } from "next/server";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

/** Liveness + database reachability. Never exposes connection details or error messages. */
export async function GET() {
  await connection();
  const startedAt = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "ok", latencyMs: Math.round(performance.now() - startedAt) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error({ err: error }, "health check: database unreachable");
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
