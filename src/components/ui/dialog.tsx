"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Modal dialog on the native <dialog> element: focus trapping, Escape-to-close and
 * inert background come from the browser.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground shadow-raised backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-2">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
          <X />
        </Button>
      </div>
      {children ? <div className="px-5 py-3">{children}</div> : null}
      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-muted/50 px-5 py-3 sm:flex-row sm:justify-end">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
