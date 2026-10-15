// Reads rows from the Excel template (already turned into objects by SheetJS)
// and checks them before anything is sent to the database.
// Pure functions: no browser or database code, so they are unit-tested.

export const PRODUCT_COLUMNS = [
  "name",
  "category",
  "brand",
  "base_unit",
  "barcode",
  "cost_per_unit",
  "retail_price",
  "wholesale_price",
  "min_wholesale_qty",
  "opening_stock_units",
  "reorder_level",
  "quick_sell",
  "pack_name",
  "units_per_pack",
  "pack_barcode",
  "pack_retail_price",
  "pack_wholesale_price",
] as const;

export const PACK_COLUMNS = [
  "product_name",
  "pack_name",
  "units_per_pack",
  "pack_barcode",
  "pack_retail_price",
  "pack_wholesale_price",
  "pack_min_wholesale_qty",
] as const;

export type ImportPack = {
  name: string;
  units_per_pack: number;
  barcode: string | null;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
};

export type ImportRow = {
  row_number: number;
  name: string;
  category: string | null;
  brand: string | null;
  base_unit: string;
  barcode: string | null;
  cost_per_unit: number | null;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
  opening_stock_units: number;
  reorder_level: number;
  quick_sell: boolean;
  packs: ImportPack[];
};

export type ImportIssue = { sheet: "products" | "packs"; row: number; message: string };

/** A raw row from SheetJS: header -> cell value, plus its 1-based spreadsheet row. */
export type RawRow = { row: number; values: Record<string, unknown> };

/** "Retail Price " -> "retail_price" */
export function normaliseHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isBlank(value: unknown) {
  return text(value) === "";
}

type NumberCheck = { min?: number; integer?: boolean; required?: boolean; above?: number };

function readNumber(
  value: unknown,
  label: string,
  check: NumberCheck,
  problems: string[],
): number | null {
  if (isBlank(value)) {
    if (check.required) problems.push(`${label} is missing`);
    return null;
  }
  const n = Number(text(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    problems.push(`${label} must be a number`);
    return null;
  }
  if (check.integer && !Number.isInteger(n)) problems.push(`${label} must be a whole number`);
  if (check.min !== undefined && n < check.min) problems.push(`${label} can't be below ${check.min}`);
  if (check.above !== undefined && n <= check.above) problems.push(`${label} must be more than ${check.above}`);
  return n;
}

function readYesNo(value: unknown, label: string, problems: string[]) {
  const v = text(value).toLowerCase();
  if (v === "" || ["no", "n", "false", "0"].includes(v)) return false;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  problems.push(`${label} must be yes or no`);
  return false;
}

function normaliseRow(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [normaliseHeader(k), v]));
}

function readPack(
  v: Record<string, unknown>,
  names: { name: string; units: string; barcode: string; retail: string; wholesale: string; minQty?: string },
  problems: string[],
): ImportPack | null {
  const units = readNumber(v[names.units], "units_per_pack", { integer: true, required: true, above: 1 }, problems);
  const retail = readNumber(v[names.retail], "pack_retail_price", { required: true, above: 0 }, problems);
  const wholesale = readNumber(v[names.wholesale], "pack_wholesale_price", { required: true, above: 0 }, problems);
  const minQty = names.minQty ? readNumber(v[names.minQty], "pack_min_wholesale_qty", { integer: true, min: 1 }, problems) : null;
  if (units === null || retail === null || wholesale === null) return null;
  return {
    name: text(v[names.name]),
    units_per_pack: units,
    barcode: text(v[names.barcode]) || null,
    retail_price: retail,
    wholesale_price: wholesale,
    min_wholesale_qty: minQty ?? 1,
  };
}

/**
 * Turns the two sheets into rows for import_products(), and lists every
 * problem found (missing price, duplicate barcode, unknown category...).
 */
export function buildImport(
  productRows: RawRow[],
  packRows: RawRow[],
  knownCategories: string[],
): { rows: ImportRow[]; issues: ImportIssue[] } {
  const categories = new Set(knownCategories.map((c) => c.trim().toLowerCase()));
  const issues: ImportIssue[] = [];
  const rows: ImportRow[] = [];
  const byName = new Map<string, ImportRow>();
  const barcodes = new Map<string, string>(); // barcode -> where it was first seen

  const claimBarcode = (code: string | null, where: string, sheet: ImportIssue["sheet"], row: number) => {
    if (!code) return;
    const first = barcodes.get(code);
    if (first) issues.push({ sheet, row, message: `Barcode ${code} is also used by ${first}` });
    else barcodes.set(code, where);
  };

  for (const raw of productRows) {
    const v = normaliseRow(raw.values);
    if (Object.values(v).every(isBlank)) continue;
    const problems: string[] = [];

    const name = text(v.name);
    if (!name) problems.push("name is missing");
    const category = text(v.category) || null;
    if (category && !categories.has(category.toLowerCase())) problems.push(`unknown category "${category}"`);

    const retail = readNumber(v.retail_price, "retail_price", { required: true, above: 0 }, problems);
    const wholesale = readNumber(v.wholesale_price, "wholesale_price", { required: true, above: 0 }, problems);
    const cost = readNumber(v.cost_per_unit, "cost_per_unit", { min: 0 }, problems);
    const minQty = readNumber(v.min_wholesale_qty, "min_wholesale_qty", { integer: true, min: 1 }, problems);
    const opening = readNumber(v.opening_stock_units, "opening_stock_units", { integer: true, min: 0 }, problems);
    const reorder = readNumber(v.reorder_level, "reorder_level", { integer: true, min: 0 }, problems);
    const quickSell = readYesNo(v.quick_sell, "quick_sell", problems);

    const packs: ImportPack[] = [];
    const packFields = ["pack_name", "units_per_pack", "pack_retail_price", "pack_wholesale_price"];
    if (packFields.some((f) => !isBlank(v[f]))) {
      if (isBlank(v.pack_name)) problems.push("pack_name is missing");
      const pack = readPack(
        v,
        { name: "pack_name", units: "units_per_pack", barcode: "pack_barcode", retail: "pack_retail_price", wholesale: "pack_wholesale_price" },
        problems,
      );
      if (pack && pack.name) packs.push(pack);
    }

    if (name && byName.has(name.toLowerCase())) problems.push(`"${name}" appears more than once`);

    for (const message of problems) issues.push({ sheet: "products", row: raw.row, message });

    const barcode = text(v.barcode) || null;
    claimBarcode(barcode, `"${name}"`, "products", raw.row);
    for (const p of packs) claimBarcode(p.barcode, `"${name}" ${p.name}`, "products", raw.row);

    if (problems.length === 0 && retail !== null && wholesale !== null) {
      const row: ImportRow = {
        row_number: raw.row,
        name,
        category,
        brand: text(v.brand) || null,
        base_unit: text(v.base_unit) || "piece",
        barcode,
        cost_per_unit: cost,
        retail_price: retail,
        wholesale_price: wholesale,
        min_wholesale_qty: minQty ?? 1,
        opening_stock_units: opening ?? 0,
        reorder_level: reorder ?? 0,
        quick_sell: quickSell,
        packs,
      };
      rows.push(row);
      byName.set(name.toLowerCase(), row);
    }
  }

  for (const raw of packRows) {
    const v = normaliseRow(raw.values);
    if (Object.values(v).every(isBlank)) continue;
    const problems: string[] = [];
    const productName = text(v.product_name);
    const product = byName.get(productName.toLowerCase());
    if (!productName) problems.push("product_name is missing");
    else if (!product) problems.push(`no product called "${productName}" on the products sheet`);
    if (isBlank(v.pack_name)) problems.push("pack_name is missing");

    const pack = readPack(
      v,
      { name: "pack_name", units: "units_per_pack", barcode: "pack_barcode", retail: "pack_retail_price", wholesale: "pack_wholesale_price", minQty: "pack_min_wholesale_qty" },
      problems,
    );
    if (pack && product && product.packs.some((p) => p.name.toLowerCase() === pack.name.toLowerCase())) {
      problems.push(`"${productName}" already has a pack called "${pack.name}"`);
    }

    for (const message of problems) issues.push({ sheet: "packs", row: raw.row, message });
    if (pack) claimBarcode(pack.barcode, `"${productName}" ${pack.name}`, "packs", raw.row);
    if (problems.length === 0 && pack && product) product.packs.push(pack);
  }

  return { rows, issues };
}
