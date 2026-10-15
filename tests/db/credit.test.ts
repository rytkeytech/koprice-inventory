// Phase 5: credit payments, statements, debtors.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, makeProduct, rowsOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let esi: string;
let kojo: string;
let milo: string;

async function creditSale(user: string, customer: string, qty: number) {
  await asUser(db, user);
  return call<{ sale_id: string }>(db, "public.complete_sale($1, 'retail', $2, $3)", [
    [{ product_id: milo, qty }],
    customer,
    { credit: qty * 10 },
  ]);
}

async function balanceOf(customer: string) {
  await asAdmin(db);
  const [c] = await rowsOf<{ balance: string }>(db, "select balance from public.customers where id = $1", [customer]);
  return c.balance;
}

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
  milo = await makeProduct(db, owner, { name: "Milo", retail_price: "10", wholesale_price: "9", opening_stock: 100 });
  await asUser(db, owner);
  [{ id: esi }, { id: kojo }] = await rowsOf<{ id: string }>(
    db,
    "insert into public.customers (name, phone, credit_limit) values ('Auntie Esi', '0241234567', 500), ('Kojo', null, 500) returning id",
  );
  await creditSale(attendant, esi, 3); // 30
  await creditSale(attendant, esi, 5); // 50
  await creditSale(attendant, kojo, 2); // 20
}, 60_000);

describe("record_credit_payment", () => {
  it("attendant records a cash repayment that lowers the balance", async () => {
    await asUser(db, attendant);
    const r = await call<{ balance: number }>(db, "public.record_credit_payment($1, 25, 'cash')", [esi]);
    expect(r.balance).toBe(55);
    expect(await balanceOf(esi)).toBe("55.00");
  });

  it("MoMo repayments need a transaction ID", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.record_credit_payment($1, 5, 'momo')", [esi])).rejects.toThrow(/transaction ID/);
    await call(db, "public.record_credit_payment($1, 5, 'momo', 'TX77')", [esi]);
    expect(await balanceOf(esi)).toBe("50.00");
  });

  it("can't pay more than is owed", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.record_credit_payment($1, 21, 'cash')", [kojo])).rejects.toThrow(
      /Kojo only owes GH₵ 20.00/,
    );
  });

  it("attendants see only the repayments they received", async () => {
    await asUser(db, attendant2);
    expect(await rowsOf(db, "select * from public.credit_payments")).toEqual([]);
    await asUser(db, attendant);
    expect((await rowsOf(db, "select * from public.credit_payments")).length).toBe(2);
  });

  it("repayments can't be deleted", async () => {
    await asAdmin(db);
    await expect(db.query("delete from public.credit_payments")).rejects.toThrow(/not allowed/);
  });
});

describe("customer_statement", () => {
  it("shows sales and payments with a running balance", async () => {
    await asUser(db, owner);
    const lines = await rowsOf<{ kind: string; debit: string; credit: string; balance: string }>(
      db,
      "select kind, debit, credit, balance from public.customer_statement($1)",
      [esi],
    );
    expect(lines.map((l) => [l.kind, Number(l.debit), Number(l.credit), Number(l.balance)])).toEqual([
      ["sale", 30, 0, 30],
      ["sale", 50, 0, 80],
      ["payment", 0, 25, 55],
      ["payment", 0, 5, 50],
    ]);
  });

  it("is owner only", async () => {
    await asUser(db, attendant);
    await expect(rowsOf(db, "select * from public.customer_statement($1)", [esi])).rejects.toThrow(/Only the owner/);
  });
});

describe("debtors", () => {
  it("lists everyone who owes, oldest unpaid first", async () => {
    await asUser(db, owner);
    const list = await rowsOf<{ name: string; balance: string; days_owed: number; last_payment_at: string | null }>(
      db,
      "select name, balance, days_owed, last_payment_at from public.debtors()",
    );
    expect(list.map((d) => [d.name, d.balance])).toEqual([
      ["Auntie Esi", "50.00"],
      ["Kojo", "20.00"],
    ]);
    expect(list[0].days_owed).toBe(0);
    expect(list[0].last_payment_at).not.toBeNull();
    expect(list[1].last_payment_at).toBeNull();
  });

  it("days owed counts from the oldest sale not yet covered by payments", async () => {
    // Make Esi's first sale 10 days old and the second 3 days old.
    await asAdmin(db);
    await db.query(
      `update public.sales set created_at = now() - interval '10 days'
        where customer_id = $1 and credit_amount = 30`,
      [esi],
    );
    await db.query(
      `update public.sales set created_at = now() - interval '3 days'
        where customer_id = $1 and credit_amount = 50`,
      [esi],
    );
    await asUser(db, owner);
    const [d] = await rowsOf<{ days_owed: number }>(db, "select days_owed from public.debtors() where id = $1", [esi]);
    // Balance 50 is fully covered by the newer 50 sale, so the 30 sale counts as paid.
    expect(d.days_owed).toBe(3);
  });

  it("is owner only", async () => {
    await asUser(db, attendant);
    await expect(rowsOf(db, "select * from public.debtors()")).rejects.toThrow(/Only the owner/);
  });
});
