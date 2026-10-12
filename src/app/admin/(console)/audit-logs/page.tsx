import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listAuditLogs } from "@/modules/audit/queries";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = PageProps<"/admin/audit-logs">["searchParams"];

function first(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/audit-logs?${next.toString()}`;
}

async function AuditContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireStaff();
  if (!can(actor, "audit.view")) return <AccessDenied permission="audit.view" />;
  const sp = await searchParams;
  const filters = { entityType: first(sp.entityType), action: first(sp.action), page: Number(first(sp.page) ?? 1) || 1 };
  const result = await listAuditLogs(actor, filters);
  const query = new URLSearchParams();
  if (filters.entityType) query.set("entityType", filters.entityType);
  if (filters.action) query.set("action", filters.action);

  return (
    <>
      <AdminPageHeader title="Audit log" description="Append-only record of privileged actions. Entries cannot be edited or deleted." />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search" aria-label="Filter audit log">
        <label htmlFor="audit-entity" className="sr-only">Entity type</label>
        <Select id="audit-entity" name="entityType" defaultValue={filters.entityType ?? ""} className="sm:w-48">
          <option value="">All entities</option>
          {result.entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <label htmlFor="audit-action" className="sr-only">Action starts with</label>
        <Input id="audit-action" name="action" placeholder="Action, e.g. staff." defaultValue={filters.action ?? ""} className="sm:w-64" />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>Filter</button>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title="No audit entries match" />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Details</Th>
              </tr>
            </THead>
            <TBody>
              {result.rows.map((row) => (
                <Tr key={row.id} className="align-top">
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.createdAt)}</Td>
                  <Td>
                    {row.actor ? (
                      <>
                        <p className="font-medium">{row.actor.name}</p>
                        <p className="text-xs text-muted-foreground">{row.actor.email}</p>
                      </>
                    ) : (
                      <Badge>{row.actorType.toLowerCase()}</Badge>
                    )}
                  </Td>
                  <Td><code className="text-xs">{row.action}</code></Td>
                  <Td className="text-xs">
                    {row.entityType}
                    {row.entityId ? <span className="block font-mono text-subtle-foreground">{row.entityId}</span> : null}
                  </Td>
                  <Td className="max-w-md text-xs">
                    {row.reason ? <p className="mb-1">Reason: {row.reason}</p> : null}
                    {row.before || row.after ? (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">Changes</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-surface-muted p-2 text-[0.6875rem]">
                          {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                    {row.ipAddress ? <p className="text-subtle-foreground">IP {row.ipAddress}</p> : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} entries
        </p>
        <div className="flex gap-2">
          {result.page > 1 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(query, result.page - 1)}>Previous</Link> : null}
          {result.page < result.pageCount ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(query, result.page + 1)}>Next</Link> : null}
        </div>
      </nav>
    </>
  );
}

export default function AuditLogPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}
