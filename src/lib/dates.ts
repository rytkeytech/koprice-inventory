// Dates are always shown in Ghana time (Africa/Accra).

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Accra",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Accra",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "16 Oct 2026" */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

/** "16 Oct, 14:05" */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}
