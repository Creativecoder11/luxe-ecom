"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/form-controls";
import { mediaUrl } from "@/lib/media";
import { mediaAction } from "../actions";

export interface MediaItem {
  id: string;
  storageKey: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

function MediaControls({ item, first, last, disabled }: { item: MediaItem; first: boolean; last: boolean; disabled: boolean }) {
  const [state, formAction] = useActionState(mediaAction, null);
  return (
    <div className="space-y-2 p-2">
      <form action={formAction} className="flex gap-1">
        <input type="hidden" name="mediaId" value={item.id} />
        <input type="hidden" name="op" value="alt" />
        <label className="sr-only" htmlFor={`alt-${item.id}`}>Alt text</label>
        <Input id={`alt-${item.id}`} name="alt" defaultValue={item.alt ?? ""} placeholder="Describe the image" className="h-8 text-xs" disabled={disabled} />
        <Button type="submit" size="sm" variant="outline" disabled={disabled}>Save</Button>
      </form>
      <div className="flex justify-between">
        <div className="flex gap-1">
          {(["up", "down"] as const).map((op) => (
            <form key={op} action={formAction}>
              <input type="hidden" name="mediaId" value={item.id} />
              <input type="hidden" name="op" value={op} />
              <Button type="submit" size="icon-sm" variant="ghost" disabled={disabled || (op === "up" ? first : last)} aria-label={op === "up" ? "Move earlier" : "Move later"}>
                {op === "up" ? <ArrowLeft /> : <ArrowRight />}
              </Button>
            </form>
          ))}
        </div>
        <form action={formAction} onSubmit={(e) => { if (!window.confirm("Delete this image?")) e.preventDefault(); }}>
          <input type="hidden" name="mediaId" value={item.id} />
          <input type="hidden" name="op" value="delete" />
          <Button type="submit" size="icon-sm" variant="ghost" className="text-danger" disabled={disabled} aria-label="Delete image">
            <Trash2 />
          </Button>
        </form>
      </div>
      <FormAlert state={state && !state.ok ? state : null} />
    </div>
  );
}

export function MediaManager({ productId, items, canEdit }: { productId: string; items: MediaItem[]; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const body = new FormData();
    for (const f of Array.from(files)) body.append("files", f);
    const response = await fetch(`/admin/catalog/products/${productId}/media`, { method: "POST", body });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Upload failed.");
    } else {
      startTransition(() => router.refresh());
    }
    if (input.current) input.current.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
        <CardDescription>JPEG, PNG or WebP up to 5 MB each, at most 10. The first image is the main one.</CardDescription>
      </CardHeader>
      <div className="space-y-4 px-5 pb-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {items.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item, i) => (
              <li key={item.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(item.storageKey)} alt={item.alt ?? ""} className="aspect-square w-full bg-surface-muted object-cover" />
                <MediaControls item={item} first={i === 0} last={i === items.length - 1} disabled={!canEdit} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No images yet. Products without images show a neutral placeholder.</p>
        )}
        {canEdit && items.length < 10 ? (
          <div>
            <label htmlFor="media-upload" className="sr-only">Upload images</label>
            <input
              ref={input}
              id="media-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => void upload(e.target.files)}
            />
            <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
              <ImagePlus /> {pending ? "Uploading…" : "Upload images"}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
