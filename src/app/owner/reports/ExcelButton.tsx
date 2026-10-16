"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { salesForExport } from "@/lib/actions/export";
import type { Dashboard, SalesReport } from "@/lib/report-types";

/** Builds an Excel file in the browser from the report on screen + all sales. */
export function ExcelButton({ dashboard, report, label }: { dashboard: Dashboard; report: SalesReport; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function download() {
    setBusy(true);
    setError(undefined);
    try {
      const [XLSX, sales] = await Promise.all([import("xlsx"), salesForExport(dashboard.from, dashboard.to)]);
      const book = XLSX.utils.book_new();
      const add = (name: string, rows: Record<string, unknown>[]) =>
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: "No data" }]), name);

      add("Summary", [
        { item: "Period", value: `${dashboard.from} to ${dashboard.to}` },
        { item: "Sales (GH₵)", value: dashboard.sales_total },
        { item: "Number of sales", value: dashboard.sales_count },
        { item: "Cash", value: dashboard.cash },
        { item: "MoMo", value: dashboard.momo },
        { item: "Credit", value: dashboard.credit },
        { item: "Retail", value: dashboard.retail },
        { item: "Wholesale", value: dashboard.wholesale },
        { item: "Cost of goods", value: dashboard.cost_total },
        { item: "Gross profit", value: dashboard.profit },
        { item: "Expenses", value: dashboard.expenses },
        { item: "Profit after expenses", value: dashboard.profit - dashboard.expenses },
        { item: "Discounts", value: dashboard.signals.discount_total },
        { item: "Credit repaid", value: dashboard.repaid },
        { item: "Money owed now", value: dashboard.money_owed },
        { item: "Stock value at cost now", value: dashboard.stock_value },
        { item: "Missing stock (counts)", value: dashboard.missing_value },
        { item: "Cash shortages", value: dashboard.shortages },
      ]);
      add("Daily sales", report.daily.map((d) => ({ date: d.date.slice(0, 10), retail: d.retail, wholesale: d.wholesale, total: d.retail + d.wholesale, sales: d.count })));
      add("Best sellers", report.best_sellers.map((b) => ({ product: b.name, units: b.units, unit: b.base_unit, revenue: b.revenue, cost: b.cost, profit: b.profit })));
      add("Slow movers", report.slow_movers.map((s) => ({ product: s.name, in_stock: s.stock_units, unit: s.base_unit, stock_value: s.stock_value, last_sold: s.last_sold?.slice(0, 10) ?? "never" })));
      add("Staff", report.attendants.map((a) => ({ name: a.name, sales: a.total, count: a.count, days: a.days, discounts: a.discounts, credit: a.credit, refunds_cancelled: a.refunds_voids })));
      add("Expenses", Object.entries(report.expenses).map(([category, amount]) => ({ category, amount })));
      add("All sales", sales.map((s) => ({ ...s, created_at: s.created_at.replace("T", " ").slice(0, 16) })));

      XLSX.writeFile(book, `koprice-${label.toLowerCase().replace(/\s+/g, "-")}-${dashboard.from}.xlsx`);
    } catch {
      setError("Could not make the Excel file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={download} disabled={busy} className="flex h-12 items-center gap-2 rounded-control border border-input bg-card px-4 font-semibold disabled:opacity-60">
        {busy ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Download aria-hidden="true" className="size-5" />}
        Download Excel
      </button>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
