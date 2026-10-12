const TIME_ZONE = "Asia/Dhaka";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });

/** Business-timezone formatting (Asia/Dhaka) so staff in any location see local business time. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormat.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: Date | string): string {
  return dateFormat.format(typeof value === "string" ? new Date(value) : value);
}
