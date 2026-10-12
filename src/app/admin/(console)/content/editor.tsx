"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { createContext, useActionState, useContext, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle, Spinner } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormAlert } from "@/components/ui/form-alert";
import type { ActionResult } from "@/lib/action-result";
import { mediaUrl } from "@/lib/media";
import type { Banner, ContentSection } from "@/modules/content/schema";
import { saveContentSectionAction } from "./actions";

const ErrorsContext = createContext<Record<string, string>>({});
const useFieldError = (name: string) => useContext(ErrorsContext)[name];

/**
 * One independently saved section. Submitted manually (not via the form action prop) so React
 * does not reset the fields when validation fails.
 */
export function SectionForm({
  section,
  title,
  description,
  children,
}: {
  section: ContentSection;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useActionState<ActionResult | null, FormData>(saveContentSectionAction, null);
  const [pending, startTransition] = useTransition();
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <Card id={`section-${section}`} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <form
        className="space-y-5 px-5 pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => dispatch(data));
        }}
      >
        <input type="hidden" name="section" value={section} />
        <ErrorsContext value={errors}>{children}</ErrorsContext>
        <FormAlert state={state} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner label="Saving" /> : null}
            {pending ? "Saving…" : `Save ${title.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TextInput({
  name,
  label,
  defaultValue,
  hint,
  multiline = false,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(aria) =>
        multiline ? (
          <Textarea {...aria} name={name} defaultValue={defaultValue} maxLength={maxLength} placeholder={placeholder} />
        ) : (
          <Input {...aria} name={name} defaultValue={defaultValue} maxLength={maxLength} placeholder={placeholder} />
        )
      }
    </Field>
  );
}

export interface CategoryOption {
  slug: string;
  label: string;
}

export function CategorySelect({ name, label, defaultValue, categories, hint }: { name: string; label: string; defaultValue?: string; categories: CategoryOption[]; hint?: string }) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(aria) => (
        <Select {...aria} name={name} defaultValue={defaultValue ?? ""}>
          <option value="">Automatic (newest products)</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Uploads immediately to /admin/content/upload and keeps the returned key in a hidden input. */
export function ImageInput({ name, label, defaultKey, hint }: { name: string; label: string; defaultKey: string | null; hint?: string }) {
  const id = useId();
  const [key, setKey] = useState(defaultKey ?? "");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldError = useFieldError(name);
  const error = uploadError ?? fieldError;

  async function upload(file: File) {
    setBusy(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/admin/content/upload", { method: "POST", body });
      const json = (await response.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!response.ok || !json.key) throw new Error(json.error ?? "Upload failed. Please try again.");
      setKey(json.key);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      <input type="hidden" name={name} value={key} />
      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-subtle-foreground">
          {key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(key)} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" aria-hidden="true" />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
              <Spinner label="Uploading" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-ring">
            {key ? "Replace" : "Upload"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-hint`}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
          {key ? (
            <Button variant="ghost" size="sm" onClick={() => setKey("")}>
              <Trash2 className="size-4" aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint ?? "JPEG, PNG or WebP up to 5 MB."} Changes apply when you save this section.
      </p>
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const EMPTY_BANNER: Banner = { title: "", subtitle: "", href: "", ctaLabel: "", imageKey: null, imageAlt: "" };

export function BannerFields({
  prefix,
  banner,
  heading,
  withCta = true,
  withSubtitle = true,
}: {
  prefix: string;
  banner?: Banner;
  heading?: string;
  withCta?: boolean;
  withSubtitle?: boolean;
}) {
  const b = banner ?? EMPTY_BANNER;
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
      {heading ? <legend className="px-1 text-sm font-semibold">{heading}</legend> : null}
      <TextInput name={`${prefix}.title`} label="Title" defaultValue={b.title} maxLength={120} />
      <TextInput name={`${prefix}.href`} label="Link" defaultValue={b.href} hint="A path such as /categories/beauty, or a full https:// address." maxLength={300} />
      {withSubtitle ? <TextInput name={`${prefix}.subtitle`} label="Text" defaultValue={b.subtitle} maxLength={240} /> : null}
      {withCta ? <TextInput name={`${prefix}.ctaLabel`} label="Button text" defaultValue={b.ctaLabel} placeholder="Shop Now" maxLength={40} /> : null}
      <ImageInput name={`${prefix}.imageKey`} label="Image" defaultKey={b.imageKey} />
      <TextInput name={`${prefix}.imageAlt`} label="Image description" defaultValue={b.imageAlt} hint="Describes the image for screen readers." maxLength={160} />
    </fieldset>
  );
}
