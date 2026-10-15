// Phase 7: requests, decisions, refunds, voids, stock adjustments.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, makeProduct, rowsOf, stockOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let milo: string;
let customer: string;

type Receipt = { sale_id: string; status: string; approval_request_id: string | null };

async function sell(user: string, qty: number, options: { credit?: number; discount?: number; note?: string } = {}) {
  await asUser(db, user);
  return call<Receipt>(db, "public.complete_sale($1, 'retail', $2, $3, $4, null, $5)", [
    [{ product_id: milo, qty }],
    options.credit ? customer : null,
    options.credit ? { credit: options.credit, cash: qty * 10 - options.credit } : { cash: 1000 },
    options.discount ?? 0,
    options.note ?? null,
  ]);
}

async function balance() {
  await asAdmin(db);
  const [c] = await rowsOf<{ balance: string }>(db, "select balance from public.customers where id = $1", [customer]);
  return Number(c.balance);
}

async function decide(id: string, approve: boolean, reason?: string) {
  await asUser(db, owner);
  return call<{ status: string; money_returned?: number }>(db, "public.decide_approval($1, $2, $3)", [id, approve, reason ?? null]);
}

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
  milo = await makeProduct(db, owner, { name: "Milo", retail_price: "10", wholesale_price: "9", opening_stock: 100, cost_per_unit: "7" });
  await asUser(db, owner);
  [{ id: customer }] = await rowsOf<{ id: string }>(db, "insert into public.customers (name, credit_limit) values ('Esi', 20) returning id");
}, 60_000);

describe("held sales", () => {
  it("approving a held credit sale completes it and takes stock", async () => {
    const before = await stockOf(db, milo);
    const r = await sell(attendant, 3, { credit: 30, note: "Pays Friday" });
    expect(r.status).toBe("held_for_approval");
    await decide(r.approval_request_id!, true);
    expect(await stockOf(db, milo)).toBe(before - 3);
    expect(await balance()).toBe(30);
    await asAdmin(db);
    const [s] = await rowsOf<{ status: string }>(db, "select status from public.sales where id = $1", [r.sale_id]);
    expect(s.status).toBe("completed");
  });

  it("rejecting a held sale voids it with no stock change", async () => {
    const before = await stockOf(db, milo);
    const r = await sell(attendant, 1, { discount: 2, note: "Old stock" });
    await decide(r.approval_request_id!, false, "No discounts on Milo");
    expect(await stockOf(db, milo)).toBe(before);
    await asAdmin(db);
    const [s] = await rowsOf<{ status: string; reverse_reason: string }>(
      db,
      "select status, reverse_reason from public.sales where id = $1",
      [r.sale_id],
    );
    expect(s).toEqual({ status: "void", reverse_reason: "No discounts on Milo" });
  });

  it("a request can only be decided once", async () => {
    const r = await sell(attendant, 1, { discount: 1, note: "x" });
    await decide(r.approval_request_id!, true);
    await expect(decide(r.approval_request_id!, true)).rejects.toThrow(/already approved/);
  });

  it("only the owner decides", async () => {
    const r = await sell(attendant, 1, { discount: 1, note: "x" });
    await asUser(db, attendant);
    await expect(call(db, "public.decide_approval($1, true)", [r.approval_request_id])).rejects.toThrow(/Only the owner/);
  });
});

describe("refunds and cancelled sales", () => {
  it("attendant asks for a refund of their own sale; approval returns stock and money", async () => {
    const r = await sell(attendant, 2);
    const before = await stockOf(db, milo);
    await asUser(db, attendant2);
    await expect(
      call(db, "public.request_approval('refund', $1)", [{ sale_id: r.sale_id, reason: "Customer returned" }]),
    ).rejects.toThrow(/Sale not found/);
    await asUser(db, attendant);
    await expect(call(db, "public.request_approval('refund', $1)", [{ sale_id: r.sale_id }])).rejects.toThrow(/Give a reason/);
    const requestId = await call<string>(db, "public.request_approval('refund', $1)", [
      { sale_id: r.sale_id, reason: "Customer returned 2 tins" },
    ]);
    await expect(
      call(db, "public.request_approval('void_sale', $1)", [{ sale_id: r.sale_id, reason: "again" }]),
    ).rejects.toThrow(/already a request waiting/);

    const result = await decide(requestId, true);
    expect(result).toMatchObject({ status: "approved", money_returned: 20 });
    expect(await stockOf(db, milo)).toBe(before + 2);
    await asAdmin(db);
    const [m] = await rowsOf<{ reason: string; change_units: number }>(
      db,
      "select reason, change_units from public.stock_movements where ref_id = $1 and reason = 'refund'",
      [r.sale_id],
    );
    expect(m).toEqual({ reason: "refund", change_units: 2 });
  });

  it("refunding a credit sale takes the credit off the customer's balance", async () => {
    const start = await balance();
    const r = await sell(owner, 1, { credit: 10 });
    expect(await balance()).toBe(start + 10);
    await asUser(db, owner);
    const result = await call<{ credit_reversed: number; money_returned: number }>(db, "public.void_sale($1, 'Wrong customer')", [
      r.sale_id,
    ]);
    expect(result).toMatchObject({ credit_reversed: 10, money_returned: 0 });
    expect(await balance()).toBe(start);
  });

  it("a sale can't be refunded twice", async () => {
    const r = await sell(owner, 1);
    await asUser(db, owner);
    await call(db, "public.refund_sale($1, 'Returned')", [r.sale_id]);
    await expect(call(db, "public.refund_sale($1, 'Again')", [r.sale_id])).rejects.toThrow(/Only completed sales/);
  });

  it("attendants cannot refund directly", async () => {
    const r = await sell(attendant, 1);
    await asUser(db, attendant);
    await expect(call(db, "public.refund_sale($1, 'x')", [r.sale_id])).rejects.toThrow(/Only the owner/);
  });

  it("the statement shows the reversal", async () => {
    await asUser(db, owner);
    const lines = await rowsOf<{ kind: string; credit: string }>(db, "select kind, credit from public.customer_statement($1)", [customer]);
    expect(lines.some((l) => l.kind === "reversal" && Number(l.credit) === 10)).toBe(true);
  });
});

describe("stock adjustments and price changes", () => {
  it("attendant reports damaged stock; owner approval removes it", async () => {
    const before = await stockOf(db, milo);
    await asUser(db, attendant);
    const id = await call<string>(db, "public.request_approval('stock_adjustment', $1)", [
      { product_id: milo, units: 2, adjust_reason: "adjust_damaged", reason: "Tins dented" },
    ]);
    expect(await stockOf(db, milo)).toBe(before);
    await decide(id, true);
    expect(await stockOf(db, milo)).toBe(before - 2);
    await asAdmin(db);
    const [m] = await rowsOf<{ reason: string; note: string }>(
      db,
      "select reason, note from public.stock_movements where product_id = $1 order by created_at desc limit 1",
      [milo],
    );
    expect(m).toEqual({ reason: "adjust_damaged", note: "Tins dented" });
  });

  it("owner adjusts stock directly; attendants can't", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.adjust_stock($1, -1, 'adjust_stolen', 'missing')", [milo])).rejects.toThrow(/Only the owner/);
    const before = await stockOf(db, milo);
    await asUser(db, owner);
    await expect(call(db, "public.adjust_stock($1, -1, 'adjust_stolen', '')", [milo])).rejects.toThrow(/Add a note/);
    await call(db, "public.adjust_stock($1, -1, 'adjust_stolen', 'Missing after weekend')", [milo]);
    expect(await stockOf(db, milo)).toBe(before - 1);
  });

  it("price change requests update the price only when approved", async () => {
    await asUser(db, attendant);
    const id = await call<string>(db, "public.request_approval('price_change', $1)", [
      { product_id: milo, retail_price: 12, wholesale_price: 11, reason: "Supplier raised price" },
    ]);
    await asAdmin(db);
    let [p] = await rowsOf<{ retail_price: string }>(db, "select retail_price from public.products where id = $1", [milo]);
    expect(p.retail_price).toBe("10.00");
    await decide(id, true);
    await asAdmin(db);
    [p] = await rowsOf<{ retail_price: string }>(db, "select retail_price from public.products where id = $1", [milo]);
    expect(p.retail_price).toBe("12.00");
  });

  it("attendants can't create discount requests directly", async () => {
    await asUser(db, attendant);
    await expect(call(db, "public.request_approval('discount', $1)", [{ reason: "x" }])).rejects.toThrow(/not allowed here/);
  });

  it("every decision is in the audit log", async () => {
    await asUser(db, owner);
    const logs = await rowsOf(db, "select * from public.audit_logs where action like 'approval_%'");
    expect(logs.length).toBeGreaterThanOrEqual(5);
  });
});
