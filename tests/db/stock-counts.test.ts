// Phase 9: stock counts and the missing stock report.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, call, createShop, makeProduct, rowsOf, stockOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let water: string;
let milo: string;
let soap: string;

type Sheet = {
  status: string;
  items: { product_id: string; counted_units: number | null; expected_units: number | null; difference_units: number | null; difference_cost: string | null }[];
};

beforeAll(async () => {
  ({ db, owner, attendant } = await createShop());
  water = await makeProduct(db, owner, { name: "Sachet water", cost_per_unit: "0.20", opening_stock: 600 });
  milo = await makeProduct(db, owner, { name: "Milo", cost_per_unit: "35", opening_stock: 20 });
  soap = await makeProduct(db, owner, { name: "Soap", cost_per_unit: "5", opening_stock: 10 });
}, 60_000);

describe("stock counts", () => {
  let countId: string;

  it("only the owner starts a count; spot counts need products", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.start_stock_count('full')")).rejects.toThrow(/Only the owner/);
    await asUser(db, owner);
    await expect(call(db, "public.start_stock_count('spot', '{}')")).rejects.toThrow(/Choose the products/);
    countId = await call<string>(db, "public.start_stock_count('spot', $1, 'Monday check')", [[water, milo]]);
  });

  it("attendants count blind: no expected figures", async () => {
    await asUser(db, attendant);
    const sheet = await call<Sheet>(db, "public.count_sheet($1)", [countId]);
    expect(sheet.items).toHaveLength(2);
    expect(sheet.items.every((i) => i.expected_units === null && i.difference_units === null)).toBe(true);
    expect(await rowsOf(db, "select * from public.stock_count_items")).toEqual([]);
  });

  it("expected is taken when the item is counted, so sales during the count don't count as missing", async () => {
    // 2 Milo sold after the count started.
    await asUser(db, attendant);
    await call(db, "public.complete_sale($1, 'retail', null, $2)", [[{ product_id: milo, qty: 2 }], { cash: 100 }]);
    await db.query("select public.submit_count_item($1, $2, 18)", [countId, milo]); // 18 = correct
    await db.query("select public.submit_count_item($1, $2, 570)", [countId, water]); // 30 sachets missing
    await asUser(db, owner);
    const sheet = await call<Sheet>(db, "public.count_sheet($1)", [countId]);
    const byId = Object.fromEntries(sheet.items.map((i) => [i.product_id, i]));
    expect(byId[milo]).toMatchObject({ expected_units: 18, counted_units: 18, difference_units: 0 });
    expect(byId[water]).toMatchObject({ expected_units: 600, counted_units: 570, difference_units: -30, difference_cost: -6 });
  });

  it("can't count products outside the count", async () => {
    await asUser(db, attendant);
    await expect(db.query("select public.submit_count_item($1, $2, 1)", [countId, soap])).rejects.toThrow(/not part of the count/);
  });

  it("finishing with corrections fixes stock through the ledger", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.complete_stock_count($1, true)", [countId])).rejects.toThrow(/Only the owner/);
    await asUser(db, owner);
    const r = await call<{ corrections: number }>(db, "public.complete_stock_count($1, true)", [countId]);
    expect(r.corrections).toBe(1);
    expect(await stockOf(db, water)).toBe(570);
    expect(await stockOf(db, milo)).toBe(18);
    await asUser(db, attendant);
    await expect(db.query("select public.submit_count_item($1, $2, 1)", [countId, water])).rejects.toThrow(/closed/);
  });

  it("finishing without corrections only records the result", async () => {
    await asUser(db, owner);
    const id = await call<string>(db, "public.start_stock_count('full')");
    await db.query("select public.submit_count_item($1, $2, 8)", [id, soap]);
    await call(db, "public.complete_stock_count($1, false)", [id]);
    expect(await stockOf(db, soap)).toBe(10);
  });
});

describe("missing stock report", () => {
  it("values missing stock at cost and lists who was on duty", async () => {
    await asUser(db, owner);
    await call(db, "public.adjust_stock($1, -1, 'adjust_expired', 'Out of date')", [milo]);
    const r = await call<{
      counts: number;
      missing_value: number;
      items: { name: string; difference: number; value: number }[];
      write_offs: Record<string, number>;
      on_duty: { name: string; sales: number }[];
    }>(db, "public.missing_stock_report(public.accra_today() - 30, public.accra_today())");
    expect(r.counts).toBe(2);
    expect(r.missing_value).toBe(16); // 30 sachets x 0.20 + 2 soap x 5
    expect(r.items.map((i) => [i.name, i.difference, i.value])).toEqual([
      ["Soap", -2, 10],
      ["Sachet water", -30, 6],
    ]);
    expect(r.write_offs).toEqual({ adjust_expired: 35 });
    expect(r.on_duty).toEqual([{ name: "Ama Attendant", days: 1, sales: 2 * 1 }]);
  });

  it("is owner only", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.missing_stock_report(public.accra_today(), public.accra_today())")).rejects.toThrow(/Only the owner/);
  });
});
