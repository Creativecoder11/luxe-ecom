import { connection } from "next/server";
import { ForbiddenError } from "@/lib/errors";
import { exportProductsCsv } from "@/modules/catalog/csv";
import { getStaffActor } from "@/modules/identity/session";

/** Permission-gated CSV download (formula-injection safe, see src/lib/csv.ts). */
export async function GET() {
  await connection();
  const actor = await getStaffActor();
  if (!actor) return new Response("Sign in required", { status: 401 });
  try {
    const { csv } = await exportProductsCsv(actor);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("You do not have permission to export products.", { status: 403 });
    throw error;
  }
}
