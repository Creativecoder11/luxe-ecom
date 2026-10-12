"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPurchaseOrderAction, purchaseOrderAction } from "./actions";

interface VariantOption {
  id: string;
  label: string;
  sku: string;
  cost: string;
}

export function NewPurchaseOrderForm({ suppliers, variants }: { suppliers: { id: string; name: string }[]; variants: VariantOption[] }) {
  const [state, formAction] = useActionState(createPurchaseOrderAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ variantId: "", quantity: "1", unitCost: "" }]);
  const update = (i: number, patch: Partial<(typeof items)[number]>) => setItems((list) => list.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify({ supplierId, expectedAt, notes, items: items.filter((i) => i.variantId) })} />
      <FormAlert state={state} />
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field id="po-supplier" label="Supplier" error={errors.supplierId} required>
          {(aria) => (
            <Select {...aria} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Choose a supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
        <Field id="po-expected" label="Expected delivery" error={errors.expectedAt}>
          {(aria) => <Input {...aria} type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />}
        </Field>
        <Field id="po-notes" label="Notes" className="sm:col-span-2">
          {(aria) => <Textarea {...aria} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Items</h2>
        {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
        {items.map((item, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
            <Field id={`po-variant-${i}`} label="Product">
              {(aria) => (
                <Select {...aria} value={item.variantId} onChange={(e) => update(i, { variantId: e.target.value, unitCost: item.unitCost || (variants.find((v) => v.id === e.target.value)?.cost ?? "") })}>
                  <option value="">Choose a product</option>
                  {variants.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>)}
                </Select>
              )}
            </Field>
            <Field id={`po-qty-${i}`} label="Quantity" error={errors[`items.${i}.quantity`]}>
              {(aria) => <Input {...aria} inputMode="numeric" value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />}
            </Field>
            <Field id={`po-cost-${i}`} label="Unit cost (৳)" error={errors[`items.${i}.unitCost`]}>
              {(aria) => <Input {...aria} inputMode="decimal" value={item.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} />}
            </Field>
            <Button variant="ghost" size="icon" aria-label="Remove item" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><X /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setItems((l) => [...l, { variantId: "", quantity: "1", unitCost: "" }])}><Plus /> Add item</Button>
      </Card>
      <SubmitButton pendingLabel="Saving…">Save draft purchase order</SubmitButton>
    </form>
  );
}

export function PurchaseOrderActions({ id, canPlace, canCancel }: { id: string; canPlace: boolean; canCancel: boolean }) {
  const [state, formAction] = useActionState(purchaseOrderAction, null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canPlace ? (
          <form action={formAction}>
            <input type="hidden" name="purchaseOrderId" value={id} />
            <input type="hidden" name="op" value="place" />
            <SubmitButton size="sm">Place order with supplier</SubmitButton>
          </form>
        ) : null}
        {canCancel ? (
          <form action={formAction} onSubmit={(e) => { if (!window.confirm("Cancel this purchase order?")) e.preventDefault(); }}>
            <input type="hidden" name="purchaseOrderId" value={id} />
            <input type="hidden" name="op" value="cancel" />
            <SubmitButton size="sm" variant="ghost" className="text-danger">Cancel</SubmitButton>
          </form>
        ) : null}
      </div>
      <FormAlert state={state} />
    </div>
  );
}

export function ReceiveForm({ id, items }: { id: string; items: { id: string; label: string; remaining: number }[] }) {
  const [state, formAction] = useActionState(purchaseOrderAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <input type="hidden" name="purchaseOrderId" value={id} />
      <input type="hidden" name="op" value="receive" />
      {items.map((item) => (
        <div key={item.id} className="flex items-end gap-3">
          <input type="hidden" name="itemId" value={item.id} />
          <Field id={`rcv-${item.id}`} label={`${item.label} (${item.remaining} left)`} error={errors[`lines.${item.id}`]} className="flex-1">
            {(aria) => <Input {...aria} name="quantity" inputMode="numeric" defaultValue={String(item.remaining)} className="h-9 w-28" />}
          </Field>
        </div>
      ))}
      <Field id="rcv-notes" label="Notes">
        {(aria) => <Input {...aria} name="notes" placeholder="e.g. invoice number, condition" />}
      </Field>
      <SubmitButton pendingLabel="Receiving…">Receive goods</SubmitButton>
    </form>
  );
}
