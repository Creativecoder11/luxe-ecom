/** Customer- and staff-facing labels for order and payment states (SRS §9). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  DELIVERY_FAILED: "Delivery failed",
  RETURN_REQUESTED: "Return requested",
  RETURN_APPROVED: "Return approved",
  RETURNED: "Returned",
  PARTIALLY_RETURNED: "Partially returned",
};

export const ORDER_STATUS_TONE: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  PENDING_CONFIRMATION: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  PACKED: "info",
  SHIPPED: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  DELIVERY_FAILED: "danger",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  COD_UNPAID: "Cash on Delivery · not yet paid",
  COD_COLLECTION_PENDING: "Cash on Delivery · collection pending",
  COD_COLLECTED: "Paid in cash",
  REMITTED: "Paid in cash",
  FAILED_COLLECTION: "Cash not collected",
  VOID: "Void",
};

export const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  FACEBOOK_MANUAL: "Facebook (manual)",
  PHONE: "Phone",
  POS: "POS",
  WHOLESALE: "Wholesale",
  OTHER: "Other",
};
