import { describe, expect, it } from "vitest";
import {
  baseUnits,
  isWholesaleApplied,
  lineTotalPesewas,
  settle,
  toPesewas,
  unitPrice,
} from "./pricing";
import { formatStock, isLowStock, plural } from "./stock";

describe("formatStock", () => {
  const bag = [{ name: "Bag", units_per_pack: 30 }];

  it("shows packs and loose units", () => {
    expect(formatStock(1032, "sachet", bag)).toBe("34 bags + 12 sachets");
  });
  it("shows only packs when nothing is loose", () => {
    expect(formatStock(60, "sachet", bag)).toBe("2 bags");
  });
  it("shows only units when below one pack or no packs", () => {
    expect(formatStock(29, "sachet", bag)).toBe("29 sachets");
    expect(formatStock(1, "tin")).toBe("1 tin");
    expect(formatStock(0, "bottle")).toBe("0 bottles");
  });
  it("uses the biggest active pack", () => {
    const packs = [
      { name: "Pack", units_per_pack: 6 },
      { name: "Crate", units_per_pack: 24 },
      { name: "Pallet", units_per_pack: 960, is_active: false },
    ];
    expect(formatStock(50, "bottle", packs)).toBe("2 crates + 2 bottles");
  });
  it("pluralises words ending in s, x, ch", () => {
    expect(plural("Box", 2)).toBe("boxes");
    expect(plural("glass", 3)).toBe("glasses");
    expect(plural("bunch", 2)).toBe("bunches");
  });
});

describe("isLowStock", () => {
  it("uses the product's reorder level", () => {
    expect(isLowStock(5, 5, 10)).toBe(true);
    expect(isLowStock(6, 5, 10)).toBe(false);
  });
  it("falls back to the shop default when the level is 0", () => {
    expect(isLowStock(10, 0, 10)).toBe(true);
    expect(isLowStock(11, 0, 10)).toBe(false);
  });
});

describe("price selection", () => {
  const bag = { retail_price: "8.00", wholesale_price: "7.00", min_wholesale_qty: 5, units_per_pack: 30 };

  it("retail mode always uses the retail price", () => {
    expect(unitPrice(bag, "retail", 100)).toBe(8);
  });
  it("wholesale price only from the minimum quantity", () => {
    expect(unitPrice(bag, "wholesale", 4)).toBe(8);
    expect(isWholesaleApplied(bag, "wholesale", 4)).toBe(false);
    expect(unitPrice(bag, "wholesale", 5)).toBe(7);
    expect(isWholesaleApplied(bag, "wholesale", 5)).toBe(true);
  });
  it("line totals have no floating-point errors", () => {
    const sachet = { retail_price: "0.10", wholesale_price: "0.10", min_wholesale_qty: 1, units_per_pack: 1 };
    expect(lineTotalPesewas(sachet, "retail", 3)).toBe(30); // 0.1 * 3 in floats is 0.30000000000000004
  });
  it("converts packs to base units", () => {
    expect(baseUnits(bag, 2)).toBe(60);
  });
});

describe("settle (payment split)", () => {
  const total = toPesewas(25);

  it("gives change from cash", () => {
    expect(settle(total, { cash: 50, momo: 0, credit: 0 })).toEqual({ ok: true, change: 2500, cashNeeded: 2500 });
  });
  it("splits cash and MoMo", () => {
    expect(settle(total, { cash: 5, momo: 20, credit: 0 })).toEqual({ ok: true, change: 0, cashNeeded: 500 });
  });
  it("credit covers the rest with no cash", () => {
    expect(settle(total, { cash: 0, momo: 0, credit: 25 })).toEqual({ ok: true, change: 0, cashNeeded: 0 });
  });
  it("says how much is still missing", () => {
    expect(settle(total, { cash: 20, momo: 0, credit: 0 })).toMatchObject({ ok: false, short: 500 });
  });
  it("rejects MoMo + credit above the total", () => {
    expect(settle(total, { cash: 0, momo: 20, credit: 10 }).ok).toBe(false);
  });
});
