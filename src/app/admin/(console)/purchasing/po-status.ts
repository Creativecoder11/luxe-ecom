export const PO_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  ORDERED: { label: "Ordered", tone: "info" },
  PARTIALLY_RECEIVED: { label: "Partially received", tone: "warning" },
  RECEIVED: { label: "Received", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};
