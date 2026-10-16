// Report periods, worked out from "today" in Ghana time (YYYY-MM-DD strings).
// Pure functions so they can be unit-tested.

export type PeriodKey = "today" | "week" | "month";

export type Period = {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
  /** The same number of days just before, for "vs last week" comparisons. */
  prevFrom: string;
  prevTo: string;
  prevLabel: string;
};

function toDate(s: string) {
  return new Date(`${s}T00:00:00Z`);
}

function toString(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, days: number) {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toString(d);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000) + 1;
}

export function periodFor(key: PeriodKey, today: string): Period {
  if (key === "today") {
    return { key, label: "Today", from: today, to: today, prevFrom: addDays(today, -1), prevTo: addDays(today, -1), prevLabel: "yesterday" };
  }
  if (key === "week") {
    // Week starts on Monday.
    const weekday = (toDate(today).getUTCDay() + 6) % 7;
    const from = addDays(today, -weekday);
    const length = daysBetween(from, today);
    return { key, label: "This week", from, to: today, prevFrom: addDays(from, -7), prevTo: addDays(from, -7 + length - 1), prevLabel: "same days last week" };
  }
  const from = `${today.slice(0, 8)}01`;
  const length = daysBetween(from, today);
  const prevMonthStart = (() => {
    const d = toDate(from);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return toString(d);
  })();
  const prevMonthEnd = addDays(from, -1);
  const prevTo = daysBetween(prevMonthStart, prevMonthEnd) < length ? prevMonthEnd : addDays(prevMonthStart, length - 1);
  return { key, label: "This month", from, to: today, prevFrom: prevMonthStart, prevTo, prevLabel: "same days last month" };
}

/** Percent change, or null when there is nothing to compare with. */
export function percentChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}
