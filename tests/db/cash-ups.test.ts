// Phase 8: my_day, submit_cash_up, confirm_cash_up.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, makeProduct, rowsOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let milo: string;
let customer: string;

type Day = {
  sales_count: number;
  sales_total: number;
  cash_sales: number;
  momo_sales: number;
  credit_given: number;
  repaid_cash: number;
  expected_cash: number;
  expected_momo: number;
  held_count: number;
  cash_up: { status: string } | null;
  sales: { receipt_no: string }[];
};

async function sell(user: string, qty: number, payment: object, extra: { customer?: string; discount?: number; note?: string } = {}) {
  await asUser(db, user);
  return call<{ sale_id: string }>(db, "public.complete_sale($1, 'retail', $2, $3, $4, null, $5)", [
    [{ product_id: milo, qty }],
    extra.customer ?? null,
    payment,
    extra.discount ?? 0,
    extra.note ?? null,
  ]);
}

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
  milo = await makeProduct(db, owner, { name: "Milo", retail_price: "10", wholesale_price: "9", opening_stock: 500 });
  await asUser(db, owner);
  [{ id: customer }] = await rowsOf<{ id: string }>(db, "insert into public.customers (name, credit_limit) values ('Esi', 1000) returning id");

  await sell(attendant, 3, { cash: 50 }); // 30 cash, 20 change
  await sell(attendant, 2, { momo: 20, momo_txn_id: "T1" }); // 20 momo
  await sell(attendant, 4, { credit: 40 }, { customer }); // 40 credit
  await sell(attendant, 1, { cash: 5, momo: 5, momo_txn_id: "T2" }); // 5 cash + 5 momo
  await sell(attendant, 1, { cash: 10 }, { discount: 1, note: "asked" }); // held: not counted
  const toVoid = await sell(attendant, 2, { cash: 20 }); // later cancelled: not counted
  await asUser(db, owner);
  await call(db, "public.void_sale($1, 'Mistake')", [toVoid.sale_id]);
  await asUser(db, attendant);
  await call(db, "public.record_credit_payment($1, 15, 'cash')", [customer]); // +15 cash
  await sell(attendant2, 5, { cash: 50 }); // someone else's sale
}, 60_000);

describe("my_day", () => {
  it("adds up the attendant's own day correctly", async () => {
    await asUser(db, attendant);
    const day = await call<Day>(db, "public.my_day()");
    expect(day).toMatchObject({
      sales_count: 4,
      sales_total: 100,
      cash_sales: 35,
      momo_sales: 25,
      credit_given: 40,
      repaid_cash: 15,
      expected_cash: 50,
      expected_momo: 25,
      held_count: 1,
      cash_up: null,
    });
    expect(day.sales).toHaveLength(6); // all sales listed, including held and cancelled
  });

  it("cash check: sales total = cash + MoMo + credit", async () => {
    await asUser(db, attendant);
    const d = await call<Day>(db, "public.my_day()");
    expect(d.cash_sales + d.momo_sales + d.credit_given).toBe(d.sales_total);
  });
});

describe("cash-up", () => {
  let cashUpId: string;

  it("expected figures come from the database, not the attendant", async () => {
    await asUser(db, attendant);
    const row = await call<{ id: string; expected_cash: string; expected_momo: string; credit_given: string; status: string }>(
      db,
      "public.submit_cash_up(null, 'safe', 45)",
    );
    cashUpId = row.id;
    expect(row).toMatchObject({ expected_cash: 50, expected_momo: 25, credit_given: 40, status: "submitted" });
  });

  it("only one cash-up per day", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.submit_cash_up(null, 'safe', 45)")).rejects.toThrow(/already closed this day/);
  });

  it("can't close future days or very old days", async () => {
    await asUser(db, attendant2);
    await expect(call(db, "public.submit_cash_up(public.accra_today() + 1, 'safe', 0)")).rejects.toThrow(/today or the last 7 days/);
    await expect(call(db, "public.submit_cash_up(public.accra_today() - 8, 'safe', 0)")).rejects.toThrow(/today or the last 7 days/);
  });

  it("attendants can't confirm; the owner records a shortage", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.confirm_cash_up($1, 50)", [cashUpId])).rejects.toThrow(/Only the owner/);
    await asUser(db, owner);
    const row = await call<{ status: string; shortage: number }>(db, "public.confirm_cash_up($1, 44, 'Counted twice')", [cashUpId]);
    expect(row).toMatchObject({ status: "short", shortage: 6 });
    await expect(call(db, "public.confirm_cash_up($1, 50)", [cashUpId])).rejects.toThrow(/already checked/);
  });

  it("enough money means confirmed", async () => {
    await asUser(db, attendant2);
    const row = await call<{ id: string }>(db, "public.submit_cash_up(null, 'momo', 50, 'TX5')");
    await asUser(db, owner);
    const confirmed = await call<{ status: string; shortage: number }>(db, "public.confirm_cash_up($1, 50)", [row.id]);
    expect(confirmed).toMatchObject({ status: "confirmed", shortage: 0 });
  });

  it("attendants see only their own cash-ups", async () => {
    await asUser(db, attendant2);
    expect((await rowsOf(db, "select * from public.cash_ups")).length).toBe(1);
    await asAdmin(db);
    await expect(db.query("delete from public.cash_ups")).rejects.toThrow(/not allowed/);
  });
});
