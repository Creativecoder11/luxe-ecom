"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ToastTone = "info" | "success" | "danger";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  notify: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastTone, string> = {
  info: "text-info",
  success: "text-success",
  danger: "text-danger",
};

const toneIcons = { info: Info, success: CircleCheck, danger: CircleAlert } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.tone === "danger" ? 8000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "danger" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-raised"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", toneStyles[toast.tone])} aria-hidden="true" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">{toast.title}</p>
                {toast.description ? <p className="text-muted-foreground">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-subtle-foreground hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
