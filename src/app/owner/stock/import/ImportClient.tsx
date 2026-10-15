"use client";

import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { buildImport, type ImportIssue, type ImportRow, type RawRow } from "@/lib/import-products";
import { formatMoney } from "@/lib/money";
import { importProducts, type ImportResult } from "./actions";

type Parsed = { fileName: string; rows: ImportRow[]; issues: ImportIssue[] };

/** Reads a sheet into objects, keeping each row's spreadsheet row number. */
function readSheet(XLSX: typeof import("xlsx"), sheet: import("xlsx").WorkSheet | undefined): RawRow[] {
  if (!sheet) return [];
  const objects = XLSX.utils.sheet_to_json<Record<string, unknown> & { __rowNum__: number }>(sheet, {
    defval: "",
    raw: true,
  });
  return objects.map((values) => ({ row: values.__rowNum__ + 1, values }));
}

export function ImportClient({ categories }: { categories: string[] }) {
  const [parsed, setParsed] = useState<Parsed>();
  const [readError, setReadError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ImportResult>();
  const [importing, startImport] = useTransition();

  async function onFile(file: File | undefined) {
    setParsed(undefined);
    setResult(undefined);
    setReadError(undefined);
    if (!file) return;
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer());
      const productsSheet = book.Sheets.products ?? book.Sheets[book.SheetNames[0]];
      const { rows, issues } = buildImport(readSheet(XLSX, productsSheet), readSheet(XLSX, book.Sheets.packs), categories);
      if (rows.length === 0 && issues.length === 0) {
        setReadError("No products found in the file. Fill in the products sheet of the template.");
      } else {
        setParsed({ fileName: file.name, rows, issues });
      }
    } catch {
      setReadError("Could not read that file. Use the Excel template (.xlsx).");
    } finally {
      setReading(false);
    }
  }

  function onImport() {
    if (!parsed) return;
    startImport(async () => setResult(await importProducts(parsed.rows)));
  }

  if (result?.ok) {
    return (
      <div className="space-y-4 rounded-card border border-line bg-card p-5">
        <div className="flex items-center gap-3 text-brand">
          <CheckCircle2 aria-hidden="true" className="size-8" />
          <p className="text-xl font-bold">Import finished</p>
        </div>
        <p>
          <strong>{result.created}</strong> new products added, <strong>{result.updated}</strong> existing products updated.
        </p>
        {result.stockNotChanged.length > 0 && (
          <p className="rounded-control bg-warning-bg p-3 text-warning">
            Stock was not changed for products that already existed ({result.stockNotChanged.join(", ")}). Use a stock
            count to correct their stock.
          </p>
        )}
        <Link href="/owner/stock" className="flex h-14 items-center justify-center rounded-control bg-brand text-lg font-bold text-white">
          Go to stock
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3 rounded-card border border-line bg-card p-4">
        <li className="space-y-2">
          <p className="font-semibold">1. Download the template and fill it in</p>
          <a
            href="/templates/koprice-products.xlsx"
            download
            className="inline-flex h-12 items-center gap-2 rounded-control border border-input px-4 font-semibold text-brand"
          >
            <Download aria-hidden="true" className="size-5" /> Download Excel template
          </a>
          <p className="text-sm text-muted">The &quot;help&quot; sheet explains every column. Categories must match: {categories.join(", ")}.</p>
        </li>
        <li className="space-y-2">
          <p className="font-semibold">2. Choose the filled-in file</p>
          <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white">
            {reading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <FileSpreadsheet aria-hidden="true" className="size-5" />}
            Choose Excel file
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </li>
      </ol>

      <FormAlert error={readError} />

      {parsed && (
        <div className="space-y-4">
          <p className="font-semibold">
            {parsed.fileName}: {parsed.rows.length} products ready
            {parsed.issues.length > 0 && <span className="text-danger">, {parsed.issues.length} problems to fix</span>}
          </p>

          {parsed.issues.length > 0 && (
            <div role="alert" className="space-y-2 rounded-card border border-danger/30 bg-danger/5 p-4">
              <p className="font-bold text-danger">Fix these in Excel, then choose the file again:</p>
              <ul className="space-y-1 text-sm">
                {parsed.issues.slice(0, 100).map((issue, i) => (
                  <li key={i}>
                    <span className="font-semibold">
                      {issue.sheet === "packs" ? "Packs sheet, row" : "Row"} {issue.row}:
                    </span>{" "}
                    {issue.message}
                  </li>
                ))}
                {parsed.issues.length > 100 && <li>…and {parsed.issues.length - 100} more.</li>}
              </ul>
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-line bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-bg text-muted">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Retail</th>
                    <th className="px-3 py-2 text-right">Wholesale</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                    <th className="px-3 py-2">Packs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.rows.slice(0, 200).map((r) => (
                    <tr key={r.row_number}>
                      <td className="px-3 py-2 text-muted">{r.row_number}</td>
                      <td className="px-3 py-2 font-semibold">{r.name}</td>
                      <td className="px-3 py-2">{r.category ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(r.retail_price)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(r.wholesale_price)}</td>
                      <td className="px-3 py-2 text-right">{r.cost_per_unit != null ? formatMoney(r.cost_per_unit) : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {r.opening_stock_units} {r.base_unit}
                      </td>
                      <td className="px-3 py-2">{r.packs.map((p) => `${p.name} (${p.units_per_pack})`).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 200 && <p className="p-3 text-sm text-muted">Showing the first 200 rows.</p>}
            </div>
          )}

          {result && !result.ok && <FormAlert error={result.error} />}

          <button
            type="button"
            onClick={onImport}
            disabled={importing || parsed.issues.length > 0 || parsed.rows.length === 0}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-50"
          >
            {importing && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
            {parsed.issues.length > 0 ? "Fix the problems first" : importing ? "Importing…" : `Import ${parsed.rows.length} products`}
          </button>
          <p className="text-center text-sm text-muted">
            If anything fails, nothing is saved. Products that already exist (same barcode or name) are updated, but their
            stock is not changed.
          </p>
        </div>
      )}
    </div>
  );
}
