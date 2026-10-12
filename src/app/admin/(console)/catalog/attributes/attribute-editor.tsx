"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardHeader, CardTitle } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { archiveAttributeAction, saveAttributeAction } from "../actions";

const TYPE_LABELS = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  BOOLEAN: "Yes / no",
  SELECT: "Single choice",
  MULTI_SELECT: "Multiple choice",
} as const;

export interface AttributeFormValue {
  id?: string;
  code: string;
  label: string;
  type: keyof typeof TYPE_LABELS;
  unit: string;
  helpText: string;
  isVariantAxis: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  min: string;
  max: string;
  integer: boolean;
  maxLength: string;
  options: { id?: string; label: string; colorHex: string }[];
  inUse: boolean;
}

export function AttributeEditor({ value, canArchive }: { value: AttributeFormValue; canArchive: boolean }) {
  const [state, formAction] = useActionState(saveAttributeAction, null);
  const [archiveState, archiveAction] = useActionState(archiveAttributeAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [form, setForm] = useState(value);
  const set = <K extends keyof AttributeFormValue>(key: K, v: AttributeFormValue[K]) => setForm((f) => ({ ...f, [key]: v }));
  const isChoice = form.type === "SELECT" || form.type === "MULTI_SELECT";
  const { inUse, id, ...payload } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{value.id ? `Edit “${value.label}”` : "New attribute"}</CardTitle>
      </CardHeader>
      <form action={formAction} className="space-y-4 px-5 pb-5" noValidate>
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        {id ? <input type="hidden" name="attributeId" value={id} /> : null}
        <FormAlert state={state} />
        {inUse ? <Alert tone="info">Products use this attribute, so its code and type are locked.</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="attr-label" label="Label" hint="Shown to staff and customers, e.g. Shade." error={errors.label} required>
            {(aria) => <Input {...aria} value={form.label} onChange={(e) => set("label", e.target.value)} />}
          </Field>
          <Field id="attr-code" label="Code" hint="Lowercase, e.g. shade or warranty_months. Used in CSV and filters." error={errors.code} required>
            {(aria) => <Input {...aria} value={form.code} disabled={inUse} onChange={(e) => set("code", e.target.value.toLowerCase())} />}
          </Field>
          <Field id="attr-type" label="Type" error={errors.type} required>
            {(aria) => (
              <Select {...aria} value={form.type} disabled={inUse} onChange={(e) => set("type", e.target.value as AttributeFormValue["type"])}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
          <Field id="attr-unit" label="Unit" hint="Optional, e.g. ml, mAh, months." error={errors.unit}>
            {(aria) => <Input {...aria} value={form.unit} onChange={(e) => set("unit", e.target.value)} />}
          </Field>
          {form.type === "NUMBER" ? (
            <>
              <Field id="attr-min" label="Minimum" error={errors.min}>
                {(aria) => <Input {...aria} inputMode="decimal" value={form.min} onChange={(e) => set("min", e.target.value)} />}
              </Field>
              <Field id="attr-max" label="Maximum" error={errors.max}>
                {(aria) => <Input {...aria} inputMode="decimal" value={form.max} onChange={(e) => set("max", e.target.value)} />}
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.integer} onChange={(e) => set("integer", e.target.checked)} /> Whole numbers only
              </label>
            </>
          ) : null}
          {form.type === "TEXT" ? (
            <Field id="attr-maxlength" label="Maximum length" error={errors.maxLength}>
              {(aria) => <Input {...aria} inputMode="numeric" value={form.maxLength} onChange={(e) => set("maxLength", e.target.value)} />}
            </Field>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Behaviour</legend>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.isVariantAxis} disabled={form.type !== "SELECT"} onChange={(e) => set("isVariantAxis", e.target.checked)} />
            <span>Variant option <span className="block text-xs text-muted-foreground">Each choice can be its own SKU with its own price (size, color, shade, storage). Single choice only.</span></span>
          </label>
          {errors.isVariantAxis ? <p className="text-xs text-danger">{errors.isVariantAxis}</p> : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.isFilterable} onChange={(e) => set("isFilterable", e.target.checked)} />
            <span>Storefront filter <span className="block text-xs text-muted-foreground">Shown as a filter on category pages (choice and yes/no attributes).</span></span>
          </label>
          {errors.isFilterable ? <p className="text-xs text-danger">{errors.isFilterable}</p> : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.isSearchable} onChange={(e) => set("isSearchable", e.target.checked)} />
            <span>Searchable <span className="block text-xs text-muted-foreground">Text values match storefront searches (e.g. ingredients, model).</span></span>
          </label>
        </fieldset>

        {isChoice ? (
          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Options</legend>
            {errors.options ? <p className="mb-2 text-xs text-danger">{errors.options}</p> : null}
            <ul className="space-y-2">
              {form.options.map((o, i) => (
                <li key={o.id ?? `new-${i}`} className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`opt-${i}`}>Option {i + 1}</label>
                  <Input id={`opt-${i}`} className="h-9" value={o.label} onChange={(e) => set("options", form.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <label className="sr-only" htmlFor={`opt-color-${i}`}>Swatch color for option {i + 1}</label>
                  <Input id={`opt-color-${i}`} className="h-9 w-28" placeholder="#hex" value={o.colorHex} onChange={(e) => set("options", form.options.map((x, j) => (j === i ? { ...x, colorHex: e.target.value } : x)))} />
                  {/^#[0-9a-fA-F]{6}$/.test(o.colorHex) ? <span className="size-6 shrink-0 rounded-full border border-border" style={{ backgroundColor: o.colorHex }} aria-hidden="true" /> : <span className="size-6 shrink-0" />}
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove option ${o.label}`} onClick={() => set("options", form.options.filter((_, j) => j !== i))}><X /></Button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => set("options", [...form.options, { label: "", colorHex: "" }])}>
              <Plus /> Add option
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Removing an option that products use archives it instead of deleting it.</p>
          </fieldset>
        ) : null}

        <SubmitButton pendingLabel="Saving…">{value.id ? "Save attribute" : "Create attribute"}</SubmitButton>
      </form>
      {value.id && canArchive ? (
        <form action={archiveAction} className="border-t border-border px-5 py-4" onSubmit={(e) => { if (!window.confirm("Archive this attribute?")) e.preventDefault(); }}>
          <input type="hidden" name="attributeId" value={value.id} />
          <FormAlert state={archiveState} />
          <SubmitButton size="sm" variant="ghost" className="text-danger">Archive attribute</SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
