import { connection, type NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/errors";
import { getStaffActor } from "@/modules/identity/session";
import { exportAdminOrdersCsv } from "@/modules/orders/admin-orders";

/** Permission-gated CSV download of the orders matching the list filters (formula-injection safe, see src/lib/csv.ts). */
export async function GET(request: NextRequest) {
  await connection();
  const actor = await getStaffActor();
  if (!actor) return new Response("Sign in required", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const get = (key: string) => sp.get(key)?.trim() || undefined;
  try {
    const { csv } = await exportAdminOrdersCsv(actor, {
      q: get("q"),
      status: get("status"),
      paymentStatus: get("payment"),
      date: get("date"),
      minTotal: get("min"),
      maxTotal: get("max"),
      sort: get("sort"),
      dir: get("dir"),
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("You do not have permission to export orders.", { status: 403 });
    throw error;
  }
}
