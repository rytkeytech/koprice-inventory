import type { Metadata } from "next";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "My day" };

// Layout skeleton only. Cash-up is built in phase 8.
export default function MyDayPage() {
  const rows = [
    { label: "My sales", value: 0 },
    { label: "MoMo received", value: 0 },
    { label: "Credit given", value: 0 },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">My day</h1>

      <div className="rounded-card border border-line bg-card p-4">
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between py-3">
              <dt className="text-muted">{row.label}</dt>
              <dd className="font-semibold">{formatMoney(row.value)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 rounded-control bg-success-bg p-4">
          <p className="text-sm font-semibold text-muted">Cash to hand over</p>
          <p className="text-3xl font-extrabold text-brand">
            {formatMoney(0)}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="h-[58px] w-full rounded-control bg-accent text-lg font-bold text-ink disabled:opacity-70"
      >
        Close my day
      </button>
      <p className="text-center text-sm text-muted">
        Closing the day is built in phase 8.
      </p>
    </section>
  );
}
