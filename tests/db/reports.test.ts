// Phase 10: owner_dashboard and sales_report.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, call, createShop, makeProduct, rowsOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let milo: string;
let water: string;
let customer: string;

beforeAll(async () => {
  ({ db, owner, attendant } = await createShop());
  milo = await makeProduct(db, owner, { name: "Milo", retail_price: "10", wholesale_price: "9", cost_per_unit: "7", opening_stock: 100 });
  water = await makeProduct(db, owner, { name: "Water", retail_price: "1", wholesale_price: "0.8", cost_per_unit: "0.5", opening_stock: 100, reorder_level: 200 });
  await makeProduct(db, owner, { name: "Slow tins", retail_price: "20", wholesale_price: "18", cost_per_unit: "15", opening_stock: 4 });
  await asUser(db, owner);
  [{ id: customer }] = await rowsOf<{ id: string }>(db, "insert into public.customers (name, credit_limit) values ('Esi', 100) returning id");

  await asUser(db, attendant);
  await call(db, "public.complete_sale($1, 'retail', null, $2)", [[{ product_id: milo, qty: 2 }], { cash: 20 }]); // 20, cost 14
  await call(db, "public.complete_sale($1, 'wholesale', $2, $3)", [[{ product_id: water, qty: 10 }], customer, { credit: 8 }]); // 8, cost 5
  await call(db, "public.complete_sale($1, 'retail', null, $2, 5, null, 'asked')", [[{ product_id: milo, qty: 1 }], { cash: 5 }]); // held
  const refund = await call<{ sale_id: string }>(db, "public.complete_sale($1, 'retail', null, $2)", [[{ product_id: milo, qty: 1 }], { cash: 10 }]);
  await asUser(db, owner);
  await call(db, "public.refund_sale($1, 'Returned')", [refund.sale_id]);
  await call(db, "public.adjust_stock($1, -2, 'adjust_damaged', 'Dented')", [milo]);
  await db.query("insert into public.expenses (category, amount, status) values ('transport', 15, 'confirmed')");
}, 60_000);

describe("owner_dashboard", () => {
  it("adds up sales, profit and the payment split (completed sales only)", async () => {
    await asUser(db, owner);
    const d = await call<Record<string, unknown>>(db, "public.owner_dashboard(public.accra_today(), public.accra_today())");
    expect(d).toMatchObject({
      sales_total: 28,
      sales_count: 2,
      cash: 20,
      momo: 0,
      credit: 8,
      retail: 20,
      wholesale: 8,
      cost_total: 19,
      profit: 9,
      expenses: 15,
      money_owed: 8,
      debtors: 1,
      low_stock: 2, // Water (below its level) and Slow tins (below the shop default of 10)
    });
    expect(d.signals).toMatchObject({ refunds: 1, held: 1, adjustments: 1, write_off_value: 14 });
    expect(d.pending).toMatchObject({ requests: 1 });
    expect((d.per_attendant as { name: string; total: number }[])[0]).toMatchObject({ name: "Ama Attendant", total: 28 });
  });

  it("is owner only", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.owner_dashboard(public.accra_today(), public.accra_today())")).rejects.toThrow(/Only the owner/);
  });
});

describe("sales_report", () => {
  it("has a row for every day, best sellers with profit, and slow movers", async () => {
    await asUser(db, owner);
    const r = await call<{
      daily: { retail: number; wholesale: number }[];
      best_sellers: { name: string; units: number; revenue: number; profit: number }[];
      slow_movers: { name: string; stock_value: number }[];
      credit_given: number;
      expenses: Record<string, number>;
    }>(db, "public.sales_report(public.accra_today() - 6, public.accra_today())");
    expect(r.daily).toHaveLength(7);
    expect(r.daily[6]).toMatchObject({ retail: 20, wholesale: 8 });
    expect(r.best_sellers.map((b) => [b.name, b.units, b.revenue, b.profit])).toEqual([
      ["Milo", 2, 20, 6],
      ["Water", 10, 8, 3],
    ]);
    expect(r.slow_movers).toEqual([expect.objectContaining({ name: "Slow tins", stock_value: 60 })]);
    expect(r.credit_given).toBe(8);
    expect(r.expenses).toEqual({ transport: 15 });
  });

  it("refuses periods over a year", async () => {
    await asUser(db, owner);
    await expect(call(db, "public.sales_report(public.accra_today() - 400, public.accra_today())")).rejects.toThrow(/up to one year/);
  });
});

