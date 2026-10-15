// Builds the blank Excel template staff/owner fill in to load products.
// Run with: npm run template   (writes public/templates/koprice-products.xlsx)
// The products and packs sheets have headers only: no sample rows, so nothing
// fake can be imported by accident. Examples live on the "help" sheet.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const PRODUCT_COLUMNS = [
  "name", "category", "brand", "base_unit", "barcode", "cost_per_unit", "retail_price",
  "wholesale_price", "min_wholesale_qty", "opening_stock_units", "reorder_level", "quick_sell",
  "pack_name", "units_per_pack", "pack_barcode", "pack_retail_price", "pack_wholesale_price",
];
const PACK_COLUMNS = [
  "product_name", "pack_name", "units_per_pack", "pack_barcode", "pack_retail_price",
  "pack_wholesale_price", "pack_min_wholesale_qty",
];

const help = [
  ["Column", "Required?", "What to type", "Example"],
  ["name", "Yes", "Product name", "Voltic sachet water"],
  ["category", "No", "Must match a category in the app (Water, Provisions...)", "Water"],
  ["brand", "No", "Brand name", "Voltic"],
  ["base_unit", "No", "Smallest thing you sell. Default: piece", "sachet"],
  ["barcode", "No", "Barcode of ONE unit", "6001234567890"],
  ["cost_per_unit", "No", "What ONE unit costs you (GH₵)", "0.18"],
  ["retail_price", "Yes", "Selling price for ONE unit (GH₵)", "0.30"],
  ["wholesale_price", "Yes", "Wholesale price for ONE unit (GH₵)", "0.25"],
  ["min_wholesale_qty", "No", "Wholesale price applies from this many units. Default 1", "1"],
  ["opening_stock_units", "No", "How many single units you have now (new products only)", "1032"],
  ["reorder_level", "No", "Warn when stock falls to this many units. 0 = shop default", "300"],
  ["quick_sell", "No", "yes = big button on the Sell screen", "yes"],
  ["pack_name", "If it has a pack", "Name of the bulk pack", "Bag"],
  ["units_per_pack", "If it has a pack", "How many units in the pack (more than 1)", "30"],
  ["pack_barcode", "No", "Barcode on the pack", ""],
  ["pack_retail_price", "If it has a pack", "Selling price for ONE pack", "8.00"],
  ["pack_wholesale_price", "If it has a pack", "Wholesale price for ONE pack", "7.00"],
  [],
  ["packs sheet", "", "Only for products with MORE than one pack (e.g. Pack of 6 and Crate of 24)."],
  ["", "", "product_name must match the name on the products sheet exactly."],
];

const book = XLSX.utils.book_new();
const products = XLSX.utils.aoa_to_sheet([PRODUCT_COLUMNS]);
products["!cols"] = PRODUCT_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
XLSX.utils.book_append_sheet(book, products, "products");
const packs = XLSX.utils.aoa_to_sheet([PACK_COLUMNS]);
packs["!cols"] = PACK_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
XLSX.utils.book_append_sheet(book, packs, "packs");
const helpSheet = XLSX.utils.aoa_to_sheet(help);
helpSheet["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 60 }, { wch: 22 }];
XLSX.utils.book_append_sheet(book, helpSheet, "help");

const outDir = fileURLToPath(new URL("../public/templates/", import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}koprice-products.xlsx`, XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
console.log("Wrote public/templates/koprice-products.xlsx");
