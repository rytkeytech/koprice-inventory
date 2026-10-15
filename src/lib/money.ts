// Money helpers. Money comes from Postgres numeric(12,2) as a string or number;
// it is only formatted here, never calculated (the database does the maths).

const formatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats an amount as "GH₵ 1,234.50". */
export function formatMoney(amount: number | string | null | undefined) {
  const value = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  return `${sign}GH₵ ${formatter.format(Math.abs(safe))}`;
}
