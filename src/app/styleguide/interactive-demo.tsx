"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function InteractiveDemo() {
  const [open, setOpen] = useState(false);
  const { notify } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open confirm dialog
      </Button>
      <Button variant="outline" onClick={() => notify({ tone: "success", title: "Saved", description: "Sample toast." })}>
        Show success toast
      </Button>
      <Button variant="outline" onClick={() => notify({ tone: "danger", title: "Could not save", description: "Sample error toast." })}>
        Show error toast
      </Button>
      <ConfirmDialog
        open={open}
        title="Archive product?"
        description="Archived products are hidden from the storefront but kept for order history."
        confirmLabel="Archive"
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          notify({ tone: "info", title: "Sample only", description: "Nothing was archived." });
        }}
      />
    </div>
  );
}
