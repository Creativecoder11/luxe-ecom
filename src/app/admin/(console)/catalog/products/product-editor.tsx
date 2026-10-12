"use client";

import { Save } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import type { CategoryNode } from "@/modules/catalog/category.service";
import type { EditorAttribute, EditorProduct, EditorVariant } from "@/modules/catalog/admin-queries";
import { buildVariantCombinations, suggestSku } from "@/modules/catalog/variants";
import { saveProductAction } from "../actions";

interface Props {
  categories: CategoryNode[];
  templates: Record<string, EditorAttribute[]>;
  brands: { id: string; name: string }[];
  taxClasses: { id: string; name: string; rateBasisPoints: number; isDefault: boolean }[];
  product: EditorProduct | null;
  canEdit: boolean;
}

const EMPTY_VARIANT: EditorVariant = { sku: "", barcode: "", price: "", compareAt: "", cost: "", weightGrams: "", isActive: true };

function AttributeInput({
  def,
  value,
  onChange,
  error,
  disabled,
}: {
  def: EditorAttribute;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  error?: string;
  disabled: boolean;
}) {
  const id = `attr-${def.code}`;
  const label = def.unit ? `${def.label} (${def.unit})` : def.label;
  if (def.type === "MULTI_SELECT") {
    const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
    return (
      <fieldset className="sm:col-span-2" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="mb-2 text-sm font-medium">
          {label}
          {def.required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {def.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(o.id)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(o.id);
                  else next.delete(o.id);
                  onChange([...next]);
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
        {error ? <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
      </fieldset>
    );
  }
  const text = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  return (
    <Field id={id} label={label} error={error} required={def.required}>
      {(aria) =>
        def.type === "SELECT" || def.type === "BOOLEAN" ? (
          <Select {...aria} value={text} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
            <option value="">{def.required ? "Choose…" : "Not set"}</option>
            {def.type === "BOOLEAN" ? (
              <>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </>
            ) : (
              def.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))
            )}
          </Select>
        ) : def.type === "TEXT" ? (
          <Input {...aria} value={text} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        ) : (
          <Input
            {...aria}
            type={def.type === "DATE" ? "date" : "text"}
            inputMode={def.type === "NUMBER" ? "decimal" : undefined}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )
      }
    </Field>
  );
}

export function ProductEditor({ categories, templates, brands, taxClasses, product, canEdit }: Props) {
  const [state, formAction] = useActionState(saveProductAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const disabled = !canEdit || product?.status === "ARCHIVED";

  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [taxClassId, setTaxClassId] = useState(product?.taxClassId ?? "");
  const [categoryId, setCategoryId] = useState(product?.primaryCategoryId ?? "");
  const [baseSku, setBaseSku] = useState(product?.baseSku ?? "");
  const [returnPolicyNote, setReturnPolicyNote] = useState(product?.returnPolicyNote ?? "");
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product?.seoDescription ?? "");
  const [attributes, setAttributes] = useState<Record<string, string | string[]>>(product?.attributes ?? {});
  const [axes, setAxes] = useState<Record<string, string[]>>(product?.axes ?? {});
  const [variants, setVariants] = useState<Record<string, EditorVariant>>(product?.variants ?? {});
  const [bulkPrice, setBulkPrice] = useState("");

  const template = useMemo(() => templates[categoryId] ?? [], [templates, categoryId]);
  const productAttributes = template.filter((d) => !d.isVariantAxis);
  const axisAttributes = template.filter((d) => d.isVariantAxis);

  const axisSelections = useMemo(
    () =>
      axisAttributes
        .map((def) => ({
          attributeId: def.id,
          label: def.label,
          options: def.options.filter((o) => (axes[def.id] ?? []).includes(o.id)),
        }))
        .filter((a) => a.options.length > 0),
    [axisAttributes, axes],
  );

  let combinationError: string | null = null;
  let combinations: ReturnType<typeof buildVariantCombinations> = [];
  try {
    combinations = buildVariantCombinations(axisSelections);
  } catch (error) {
    combinationError = error instanceof Error ? error.message : "Too many variants";
  }

  const variantFor = (key: string) => variants[key] ?? EMPTY_VARIANT;
  const updateVariant = (key: string, patch: Partial<EditorVariant>) =>
    setVariants((current) => ({ ...current, [key]: { ...(current[key] ?? EMPTY_VARIANT), ...patch } }));

  const payload = JSON.stringify({
    title,
    slug,
    description,
    brandId,
    taxClassId,
    primaryCategoryId: categoryId,
    baseSku,
    returnPolicyNote,
    seoTitle,
    seoDescription,
    // Only attributes in the current template are sent; the server validates them again.
    attributes: Object.fromEntries(productAttributes.filter((d) => attributes[d.code] !== undefined).map((d) => [d.code, attributes[d.code]!])),
    axes: axisSelections.map((a) => ({ attributeId: a.attributeId, optionIds: a.options.map((o) => o.id) })),
    variants: combinations.map((c) => {
      const v = variantFor(c.key);
      return { ...v, combinationKey: c.key, sku: v.sku || suggestSku(baseSku || slug || title, c.values) };
    }),
  });

  const variantErrors = Object.entries(errors).filter(([k]) => k.startsWith("variants"));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="payload" value={payload} />
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <FormAlert state={state} />
      {product?.status === "ARCHIVED" ? <Alert tone="warning">This product is archived. Restore it to make changes.</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field id="title" label="Title" error={errors.title} required className="sm:col-span-2">
            {(aria) => <Input {...aria} value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} />}
          </Field>
          <Field id="category" label="Category" error={errors.primaryCategoryId} required hint="Determines which details and variant options apply.">
            {(aria) => (
              <Select {...aria} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={disabled}>
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.depth)}
                    {c.name}
                    {c.status === "HIDDEN" ? " (hidden)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="brand" label="Brand" error={errors.brandId}>
            {(aria) => (
              <Select {...aria} value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={disabled}>
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="taxClass" label="VAT class" hint="Rates are set in Settings." error={errors.taxClassId}>
            {(aria) => (
              <Select {...aria} value={taxClassId} onChange={(e) => setTaxClassId(e.target.value)} disabled={disabled}>
                <option value="">Business default{(() => { const d = taxClasses.find((t) => t.isDefault); return d ? ` (${d.name}, ${d.rateBasisPoints / 100}%)` : ""; })()}</option>
                {taxClasses.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.rateBasisPoints / 100}%)</option>)}
              </Select>
            )}
          </Field>
          <Field id="description" label="Description" error={errors.description} className="sm:col-span-2">
            {(aria) => <Textarea {...aria} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} disabled={disabled} />}
          </Field>
        </div>
      </Card>

      {categoryId ? (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Fields come from the category template. Required fields must be filled before publishing.</CardDescription>
          </CardHeader>
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            {productAttributes.length === 0 ? <p className="text-sm text-muted-foreground">This category has no product details configured.</p> : null}
            {productAttributes.map((def) => (
              <AttributeInput
                key={def.id}
                def={def}
                value={attributes[def.code]}
                onChange={(value) => setAttributes((current) => ({ ...current, [def.code]: value }))}
                error={errors[`attributes.${def.code}`]}
                disabled={disabled}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {categoryId ? (
        <Card>
          <CardHeader>
            <CardTitle>Variants and pricing</CardTitle>
            <CardDescription>
              {axisAttributes.length
                ? "Choose the options you sell. Each combination becomes a variant with its own SKU and price."
                : "This category has no variant options, so the product has a single SKU."}
            </CardDescription>
          </CardHeader>
          <div className="space-y-5 px-5 pb-5">
            {axisAttributes.map((def) => (
              <fieldset key={def.id}>
                <legend className="mb-2 text-sm font-medium">
                  {def.label}
                  {def.required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {def.options.map((o) => {
                    const checked = (axes[def.id] ?? []).includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${checked ? "border-primary bg-accent-soft" : "border-border-strong"}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          className="sr-only"
                          onChange={(e) =>
                            setAxes((current) => {
                              const list = new Set(current[def.id] ?? []);
                              if (e.target.checked) list.add(o.id);
                              else list.delete(o.id);
                              return { ...current, [def.id]: def.options.map((x) => x.id).filter((id) => list.has(id)) };
                            })
                          }
                        />
                        {o.colorHex ? <span className="size-3.5 rounded-full border border-black/10" style={{ backgroundColor: o.colorHex }} aria-hidden="true" /> : null}
                        {o.label}
                      </label>
                    );
                  })}
                </div>
                {errors[`axes.${def.code}`] ? <p className="mt-1 text-xs font-medium text-danger">{errors[`axes.${def.code}`]}</p> : null}
              </fieldset>
            ))}
            {errors.axes ? <Alert tone="danger">{errors.axes}</Alert> : null}
            {combinationError ? <Alert tone="danger">{combinationError}</Alert> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="baseSku" label="Product code" hint="Used to suggest SKUs, e.g. TEE-CREW." error={errors.baseSku}>
                {(aria) => <Input {...aria} value={baseSku} onChange={(e) => setBaseSku(e.target.value.toUpperCase())} disabled={disabled} />}
              </Field>
              {combinations.length > 1 ? (
                <div className="flex items-end gap-2 sm:col-span-2">
                  <Field id="bulkPrice" label="Set price for all variants (৳)">
                    {(aria) => <Input {...aria} inputMode="decimal" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} disabled={disabled} />}
                  </Field>
                  <Button
                    variant="outline"
                    disabled={disabled || !bulkPrice}
                    onClick={() => combinations.forEach((c) => updateVariant(c.key, { price: bulkPrice }))}
                  >
                    Apply
                  </Button>
                </div>
              ) : null}
            </div>

            {variantErrors.length ? (
              <Alert tone="danger" title="Fix the variant errors below">
                <ul className="list-disc pl-4">
                  {[...new Set(variantErrors.map(([, message]) => message))].map((m) => <li key={m}>{m}</li>)}
                </ul>
              </Alert>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[68rem] text-sm">
                <thead className="bg-surface-muted/60 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2">Variant</th>
                    <th className="min-w-[14rem] px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Price (৳)</th>
                    <th className="px-3 py-2">Was (৳)</th>
                    <th className="px-3 py-2">Cost (৳)</th>
                    <th className="px-3 py-2">Barcode</th>
                    <th className="px-3 py-2">Weight (g)</th>
                    <th className="px-3 py-2">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {combinations.map((c) => {
                    const v = variantFor(c.key);
                    const err = (field: string) => errors[`variants.${c.key}.${field}`];
                    const cell = (field: keyof EditorVariant, placeholder = "", inputMode?: "decimal" | "numeric") => (
                      <td className="px-3 py-2 align-top">
                        <Input
                          aria-label={`${String(field)} for ${c.title}`}
                          aria-invalid={err(String(field)) ? true : undefined}
                          className="h-9"
                          inputMode={inputMode}
                          placeholder={placeholder}
                          value={String(v[field])}
                          onChange={(e) => updateVariant(c.key, { [field]: field === "sku" ? e.target.value.toUpperCase() : e.target.value })}
                          disabled={disabled}
                        />
                        {err(String(field)) ? <p className="mt-1 text-xs text-danger">{err(String(field))}</p> : null}
                      </td>
                    );
                    return (
                      <tr key={c.key}>
                        <td className="px-3 py-2 align-top font-medium whitespace-nowrap">{c.title}</td>
                        {cell("sku", suggestSku(baseSku || slug || title || "SKU", c.values))}
                        {cell("price", "0", "decimal")}
                        {cell("compareAt", "", "decimal")}
                        {cell("cost", "", "decimal")}
                        {cell("barcode")}
                        {cell("weightGrams", "", "numeric")}
                        <td className="px-3 py-2 align-top">
                          <Checkbox
                            aria-label={`Active: ${c.title}`}
                            checked={v.isActive}
                            disabled={disabled}
                            onChange={(e) => updateVariant(c.key, { isActive: e.target.checked })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Prices are in taka and stored exactly. “Was” price shows a sale. Cost is private and used for profit reports.
              Empty SKUs use the suggestion shown.
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Search engine and policy</CardTitle>
        </CardHeader>
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field id="slug" label="URL slug" hint="Leave empty to generate from the title." error={errors.slug}>
            {(aria) => <Input {...aria} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={disabled} />}
          </Field>
          <Field id="seoTitle" label="SEO title" hint="Up to 70 characters." error={errors.seoTitle}>
            {(aria) => <Input {...aria} maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} disabled={disabled} />}
          </Field>
          <Field id="seoDescription" label="SEO description" hint="Up to 160 characters." error={errors.seoDescription} className="sm:col-span-2">
            {(aria) => <Textarea {...aria} maxLength={160} rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} disabled={disabled} />}
          </Field>
          <Field id="returnPolicyNote" label="Return policy note" hint="Shown on the product page, e.g. hygiene items." error={errors.returnPolicyNote} className="sm:col-span-2">
            {(aria) => <Textarea {...aria} rows={2} value={returnPolicyNote} onChange={(e) => setReturnPolicyNote(e.target.value)} disabled={disabled} />}
          </Field>
        </div>
      </Card>

      {canEdit && product?.status !== "ARCHIVED" ? (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-sm text-muted-foreground">
            {product ? (
              <>Status: <Badge tone={product.status === "ACTIVE" ? "success" : "neutral"}>{product.status === "ACTIVE" ? "Published" : "Draft"}</Badge></>
            ) : (
              "New products are saved as drafts."
            )}
          </p>
          <SubmitButton pendingLabel="Saving…" disabled={!!combinationError}>
            <Save /> {product ? "Save changes" : "Save draft"}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
