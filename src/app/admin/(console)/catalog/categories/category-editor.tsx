"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export interface CategoryFormValue {
  id?: string;
  name: string;
  slug: string;
  parentId: string;
  description: string;
  status: "ACTIVE" | "HIDDEN";
  sortOrder: number;
  defaultTrackingMode: "NONE" | "BATCH_EXPIRY" | "SERIAL";
  attributes: { attributeId: string; isRequired: boolean }[];
}

interface Props {
  value: CategoryFormValue;
  parents: { id: string; name: string; depth: number }[];
  attributes: { id: string; label: string; code: string; type: string; isVariantAxis: boolean }[];
  canDelete: boolean;
}

export function CategoryEditor({ value, parents, attributes, canDelete }: Props) {
  const [state, formAction] = useActionState(saveCategoryAction, null);
  const [deleteState, deleteAction] = useActionState(deleteCategoryAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [form, setForm] = useState<CategoryFormValue>(value);
  const set = <K extends keyof CategoryFormValue>(key: K, v: CategoryFormValue[K]) => setForm((f) => ({ ...f, [key]: v }));
  const available = attributes.filter((a) => !form.attributes.some((t) => t.attributeId === a.id));
  const move = (index: number, delta: number) =>
    setForm((f) => {
      const next = [...f.attributes];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return { ...f, attributes: next };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{value.id ? `Edit “${value.name}”` : "New category"}</CardTitle>
      </CardHeader>
      <form action={formAction} className="space-y-4 px-5 pb-5" noValidate>
        <input type="hidden" name="payload" value={JSON.stringify(form)} />
        {value.id ? <input type="hidden" name="categoryId" value={value.id} /> : null}
        <FormAlert state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cat-name" label="Name" error={errors.name} required>
            {(aria) => <Input {...aria} value={form.name} onChange={(e) => set("name", e.target.value)} />}
          </Field>
          <Field id="cat-slug" label="URL slug" hint="Leave empty to generate from the name." error={errors.slug}>
            {(aria) => <Input {...aria} value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} />}
          </Field>
          <Field id="cat-parent" label="Parent category" error={errors.parentId}>
            {(aria) => (
              <Select {...aria} value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
                <option value="">None (top level)</option>
                {parents.filter((p) => p.id !== value.id).map((p) => (
                  <option key={p.id} value={p.id}>{"  ".repeat(p.depth)}{p.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="cat-status" label="Visibility">
            {(aria) => (
              <Select {...aria} value={form.status} onChange={(e) => set("status", e.target.value as CategoryFormValue["status"])}>
                <option value="ACTIVE">Visible in the store</option>
                <option value="HIDDEN">Hidden (with its subcategories and products)</option>
              </Select>
            )}
          </Field>
          <Field id="cat-tracking" label="Default traceability" hint="Applied to new products in this category.">
            {(aria) => (
              <Select {...aria} value={form.defaultTrackingMode} onChange={(e) => set("defaultTrackingMode", e.target.value as CategoryFormValue["defaultTrackingMode"])}>
                <option value="NONE">None</option>
                <option value="BATCH_EXPIRY">Batch and expiry (cosmetics, food)</option>
                <option value="SERIAL">Serial / IMEI (gadgets)</option>
              </Select>
            )}
          </Field>
          <Field id="cat-sort" label="Sort order" error={errors.sortOrder}>
            {(aria) => <Input {...aria} inputMode="numeric" value={String(form.sortOrder)} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />}
          </Field>
          <Field id="cat-description" label="Description" className="sm:col-span-2">
            {(aria) => <Textarea {...aria} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
        </div>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Attribute template</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Products in this category (and its subcategories) get these fields. Parent templates are inherited.
          </p>
          <ul className="space-y-2">
            {form.attributes.map((t, i) => {
              const attr = attributes.find((a) => a.id === t.attributeId);
              return (
                <li key={t.attributeId} className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
                  <span className="flex-1">
                    {attr?.label ?? "Unknown"} <span className="text-xs text-subtle-foreground">{attr?.code}{attr?.isVariantAxis ? " · variant option" : ""}</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={t.isRequired}
                      onChange={(e) => set("attributes", form.attributes.map((x) => (x.attributeId === t.attributeId ? { ...x, isRequired: e.target.checked } : x)))}
                    />
                    Required
                  </label>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${attr?.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${attr?.label} down`} disabled={i === form.attributes.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${attr?.label}`} onClick={() => set("attributes", form.attributes.filter((x) => x.attributeId !== t.attributeId))}><X /></Button>
                </li>
              );
            })}
          </ul>
          {available.length ? (
            <div className="mt-3">
              <label htmlFor="add-attribute" className="sr-only">Add attribute</label>
              <Select
                id="add-attribute"
                value=""
                onChange={(e) => e.target.value && set("attributes", [...form.attributes, { attributeId: e.target.value, isRequired: false }])}
                className="h-9 sm:w-72"
              >
                <option value="">+ Add an attribute…</option>
                {available.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.code})</option>)}
              </Select>
            </div>
          ) : null}
        </fieldset>

        <div className="flex items-center justify-between gap-2">
          <SubmitButton pendingLabel="Saving…">{value.id ? "Save category" : "Create category"}</SubmitButton>
        </div>
      </form>
      {value.id && canDelete ? (
        <form
          action={deleteAction}
          className="border-t border-border px-5 py-4"
          onSubmit={(e) => {
            if (!window.confirm("Delete this category?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="categoryId" value={value.id} />
          <FormAlert state={deleteState} />
          <SubmitButton size="sm" variant="ghost" className="text-danger">Delete category</SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
