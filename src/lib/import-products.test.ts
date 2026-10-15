import { describe, expect, it } from "vitest";
import { buildImport, normaliseHeader, type RawRow } from "./import-products";

const categories = ["Water", "Provisions"];

function product(row: number, values: Record<string, unknown>): RawRow {
  return {
    row,
    values: { name: "Item", category: "Water", retail_price: 1, wholesale_price: 1, ...values },
  };
}

describe("normaliseHeader", () => {
  it("lower-cases and joins words with underscores", () => {
    expect(normaliseHeader(" Retail Price ")).toBe("retail_price");
    expect(normaliseHeader("units-per-pack")).toBe("units_per_pack");
  });
});

describe("buildImport", () => {
  it("reads a full row with a pack", () => {
    const { rows, issues } = buildImport(
      [
        product(2, {
          name: "Sachet water",
          base_unit: "sachet",
          barcode: 600123,
          cost_per_unit: "0.18",
          retail_price: "0.30",
          wholesale_price: 0.25,
          opening_stock_units: 600,
          quick_sell: "Yes",
          pack_name: "Bag",
          units_per_pack: 30,
          pack_retail_price: 8,
          pack_wholesale_price: 7,
        }),
      ],
      [],
      categories,
    );
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({
      row_number: 2,
      name: "Sachet water",
      barcode: "600123",
      cost_per_unit: 0.18,
      opening_stock_units: 600,
      quick_sell: true,
      packs: [{ name: "Bag", units_per_pack: 30, retail_price: 8, wholesale_price: 7, min_wholesale_qty: 1 }],
    });
  });

  it("accepts headers with capitals and spaces", () => {
    const { rows, issues } = buildImport(
      [{ row: 2, values: { Name: "Milo", Category: "provisions", "Retail Price": 45, "Wholesale Price": 42 } }],
      [],
      categories,
    );
    expect(issues).toEqual([]);
    expect(rows[0].name).toBe("Milo");
  });

  it("flags missing prices and unknown categories with row numbers", () => {
    const { rows, issues } = buildImport(
      [product(3, { retail_price: "" }), product(4, { name: "Shoe", category: "Shoes" })],
      [],
      categories,
    );
    expect(rows).toEqual([]);
    expect(issues).toEqual([
      { sheet: "products", row: 3, message: "retail_price is missing" },
      { sheet: "products", row: 4, message: 'unknown category "Shoes"' },
    ]);
  });

  it("flags duplicate barcodes across products and packs", () => {
    const { issues } = buildImport(
      [
        product(2, { name: "A", barcode: "111" }),
        product(3, { name: "B", pack_name: "Box", units_per_pack: 10, pack_retail_price: 5, pack_wholesale_price: 4, pack_barcode: "111" }),
      ],
      [],
      categories,
    );
    expect(issues).toEqual([{ sheet: "products", row: 3, message: 'Barcode 111 is also used by "A"' }]);
  });

  it("flags bad numbers and yes/no values", () => {
    const { issues } = buildImport(
      [product(5, { opening_stock_units: -3, min_wholesale_qty: 1.5, quick_sell: "maybe", retail_price: "abc" })],
      [],
      categories,
    );
    expect(issues.map((i) => i.message)).toEqual([
      "retail_price must be a number",
      "min_wholesale_qty must be a whole number",
      "opening_stock_units can't be below 0",
      "quick_sell must be yes or no",
    ]);
  });

  it("adds packs from the packs sheet and checks the product exists", () => {
    const { rows, issues } = buildImport(
      [product(2, { name: "Coke 50cl", pack_name: "Pack", units_per_pack: 6, pack_retail_price: 30, pack_wholesale_price: 28 })],
      [
        { row: 2, values: { product_name: "coke 50cl", pack_name: "Crate", units_per_pack: 24, pack_retail_price: 110, pack_wholesale_price: 100, pack_min_wholesale_qty: 3 } },
        { row: 3, values: { product_name: "Fanta", pack_name: "Crate", units_per_pack: 24, pack_retail_price: 110, pack_wholesale_price: 100 } },
        { row: 4, values: { product_name: "Coke 50cl", pack_name: "pack", units_per_pack: 6, pack_retail_price: 30, pack_wholesale_price: 28 } },
      ],
      categories,
    );
    expect(rows[0].packs.map((p) => [p.name, p.min_wholesale_qty])).toEqual([
      ["Pack", 1],
      ["Crate", 3],
    ]);
    expect(issues).toEqual([
      { sheet: "packs", row: 3, message: 'no product called "Fanta" on the products sheet' },
      { sheet: "packs", row: 4, message: '"Coke 50cl" already has a pack called "pack"' },
    ]);
  });

  it("skips empty rows and flags repeated names", () => {
    const { rows, issues } = buildImport(
      [product(2, { name: "Milo" }), { row: 3, values: { name: "", retail_price: "" } }, product(4, { name: "milo" })],
      [],
      categories,
    );
    expect(rows).toHaveLength(1);
    expect(issues).toEqual([{ sheet: "products", row: 4, message: '"milo" appears more than once' }]);
  });
});
