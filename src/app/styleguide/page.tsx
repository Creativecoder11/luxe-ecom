import { Inbox, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { KpiCard } from "@/components/admin/kpi-card";
import { ModuleStatusNotice } from "@/components/common/module-status-notice";
import { ProductCard } from "@/components/storefront/product-card";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState, Skeleton, Spinner } from "@/components/ui/display";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Table, TableCaption, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { shellPreviewEnabled } from "@/lib/env";
import { InteractiveDemo } from "./interactive-demo";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  if (!shellPreviewEnabled()) notFound();

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Design system</h1>
        <Alert tone="warning" title="Development reference">
          Every product, price and label on this page is <strong>sample content</strong> for component review. This
          page is not available in production builds.
        </Alert>
      </header>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Cart">
            <ShoppingBag />
          </Button>
        </div>
      </Block>

      <Block title="Form controls">
        <form className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field id="sg-name" label="Product title" hint="Shown on the storefront." required>
            {(aria) => <Input {...aria} placeholder="e.g. Hydrating face serum" />}
          </Field>
          <Field id="sg-phone" label="Mobile number" error="Enter a valid Bangladesh mobile number.">
            {(aria) => <Input {...aria} inputMode="tel" defaultValue="0171" />}
          </Field>
          <Field id="sg-district" label="District">
            {(aria) => (
              <Select {...aria} defaultValue="">
                <option value="" disabled>
                  Select district
                </option>
                <option>Dhaka</option>
                <option>Chattogram</option>
              </Select>
            )}
          </Field>
          <Field id="sg-notes" label="Order note">
            {(aria) => <Textarea {...aria} placeholder="Delivery instructions" />}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked /> Receive order updates by SMS
          </label>
        </form>
      </Block>

      <Block title="Badges, alerts and status">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Delivered</Badge>
          <Badge tone="warning">Pending confirmation</Badge>
          <Badge tone="danger">Cancelled</Badge>
          <Badge tone="info">Shipped</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Courier not configured">Manual booking is available.</Alert>
          <Alert tone="success" title="Stock adjusted">Ledger entry recorded.</Alert>
          <Alert tone="warning" title="Low stock">3 variants at or below reorder level.</Alert>
          <Alert tone="danger" title="Payment webhook rejected">Signature verification failed.</Alert>
        </div>
        <ModuleStatusNotice status="planned" gate={6} />
      </Block>

      <Block title="Product cards (sample data)">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          <ProductCard product={{ href: "#", title: "Sample hydrating serum 30 ml", brand: "Sample brand", priceMinor: 125000, currency: "BDT" }} />
          <ProductCard product={{ href: "#", title: "Sample cotton kurti", brand: "Sample brand", priceMinor: 189000, compareAtMinor: 249000, currency: "BDT" }} />
          <ProductCard product={{ href: "#", title: "Sample wireless earbuds", priceMinor: 349900, currency: "BDT", badge: "New" }} />
          <ProductCard product={{ href: "#", title: "Sample ceramic mug set", priceMinor: 89000, currency: "BDT", badge: "Out of stock" }} />
        </div>
      </Block>

      <Block title="KPI cards">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Orders" value={null} definition="No data state: shown until real records exist." />
          <KpiCard label="Sample metric" value="৳12,34,567.00" definition="Sample value for layout review only." />
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </Card>
        </div>
      </Block>

      <Block title="Table">
        <Card>
          <Table>
            <TableCaption>Sample rows for layout review.</TableCaption>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </THead>
            <TBody>
              <Tr>
                <Td className="font-medium">SAMPLE-0001</Td>
                <Td>Website</Td>
                <Td><Badge tone="warning">Pending confirmation</Badge></Td>
                <Td className="text-right tabular-nums">৳1,250.00</Td>
              </Tr>
              <Tr>
                <Td className="font-medium">SAMPLE-0002</Td>
                <Td>Facebook (manual)</Td>
                <Td><Badge tone="info">Shipped</Badge></Td>
                <Td className="text-right tabular-nums">৳3,499.00</Td>
              </Tr>
            </TBody>
          </Table>
        </Card>
      </Block>

      <Block title="Empty, loading and feedback">
        <EmptyState icon={<Inbox />} title="No orders yet" description="Orders from every channel appear here." action={<Button variant="outline">Create manual order</Button>} />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner /> Loading state
        </div>
        <InteractiveDemo />
      </Block>
    </main>
  );
}
