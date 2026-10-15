// Phase 4: complete_sale and sale_receipt.
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, createUser, makeProduct, rowsOf, stockOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let water: string;
let bagId: string;
let milo: string;
let customer: string;

type Receipt = {
  sale_id: string;
  receipt_no: string;
  status: string;
  subtotal: string;
  discount: string;
  total: string;
  change_given: string;
  credit_amount: string;
  approval_request_id: string | null;
  items: { name: string; unit_name: string; qty: number; unit_price: string; line_total: string }[];
};

async function sell(
  user: string,
  items: unknown[],
  options: { mode?: string; customer?: string | null; payment?: object; discount?: number; ref?: string; note?: string } = {},
) {
  await asUser(db, user);
  return call<Receipt>(db, "public.complete_sale($1, $2, $3, $4, $5, $6, $7)", [
    items,
    options.mode ?? "retail",
    options.customer ?? null,
    options.payment ?? { cash: 1000 },
    options.discount ?? 0,
    options.ref ?? null,
    options.note ?? null,
  ]);
}

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
  water = await makeProduct(db, owner, {
    name: "Sachet water",
    base_unit_name: "sachet",
    retail_price: "0.30",
    wholesale_price: "0.25",
    min_wholesale_qty: 100,
    cost_per_unit: "0.1833",
    opening_stock: 3000,
    packs: [{ name: "Bag", units_per_pack: 30, retail_price: "8.00", wholesale_price: "7.00", min_wholesale_qty: 5 }],
  });
  milo = await makeProduct(db, owner, { name: "Milo", retail_price: "45", wholesale_price: "42", opening_stock: 10 });
  await asAdmin(db);
  [{ id: bagId }] = await rowsOf<{ id: string }>(db, "select id from public.product_packs where product_id = $1", [water]);
  await asUser(db, owner);
  [{ id: customer }] = await rowsOf<{ id: string }>(
    db,
    "insert into public.customers (name, credit_limit) values ('Auntie Esi', 50) returning id",
  );
}, 60_000);

describe("prices come from the database", () => {
  it("ignores any price the client sends", async () => {
    const r = await sell(attendant, [{ product_id: milo, qty: 1, unit_price: 0.01, line_total: 0.01 }], {
      payment: { cash: 50 },
    });
    expect(r.status).toBe("completed");
    expect(r.total).toBe(45);
    expect(r.change_given).toBe(5);
    expect(r.receipt_no).toMatch(/^KP-\d{6}$/);
  });

  it("sells packs and takes base units from stock", async () => {
    const before = await stockOf(db, water);
    const r = await sell(attendant, [{ product_id: water, pack_id: bagId, qty: 2 }]);
    expect(r.items[0]).toMatchObject({ unit_name: "Bag", qty: 2, unit_price: 8, line_total: 16 });
    expect(await stockOf(db, water)).toBe(before - 60);
  });

  it("applies wholesale price only from the minimum quantity", async () => {
    const below = await sell(attendant, [{ product_id: water, pack_id: bagId, qty: 4 }], { mode: "wholesale" });
    expect(below.items[0].unit_price).toBe(8);
    const at = await sell(attendant, [{ product_id: water, pack_id: bagId, qty: 5 }], { mode: "wholesale" });
    expect(at.items[0].unit_price).toBe(7);
  });

  it("records the cost snapshot for profit (owner only)", async () => {
    const r = await sell(attendant, [{ product_id: water, qty: 10 }]);
    await asUser(db, owner);
    const [cost] = await rowsOf<{ unit_cost: string; cost_total: string }>(
      db,
      "select unit_cost, cost_total from public.sale_item_costs where sale_id = $1",
      [r.sale_id],
    );
    expect(cost).toEqual({ unit_cost: "0.1833", cost_total: "1.83" });
    await asUser(db, attendant);
    expect(await rowsOf(db, "select * from public.sale_item_costs")).toEqual([]);
  });
});

describe("stock and payment checks", () => {
  it("refuses to sell more than is in stock, and saves nothing", async () => {
    await asAdmin(db);
    const [{ count: before }] = await rowsOf<{ count: number }>(db, "select count(*)::int as count from public.sales");
    await expect(sell(attendant, [{ product_id: milo, qty: 5 }, { product_id: milo, qty: 5 }])).rejects.toThrow(
      /Not enough stock for Milo: 9 in stock, 10 needed/,
    );
    await asAdmin(db);
    const [{ count: after }] = await rowsOf<{ count: number }>(db, "select count(*)::int as count from public.sales");
    expect(after).toBe(before);
    expect(await stockOf(db, milo)).toBe(9);
  });

  it("needs enough cash", async () => {
    await expect(sell(attendant, [{ product_id: milo, qty: 1 }], { payment: { cash: 40 } })).rejects.toThrow(
      /Not enough cash: GH₵ 5.00 more needed/,
    );
  });

  it("needs a MoMo transaction ID", async () => {
    await expect(sell(attendant, [{ product_id: milo, qty: 1 }], { payment: { momo: 45 } })).rejects.toThrow(
      /MoMo transaction ID/,
    );
    const r = await sell(attendant, [{ product_id: milo, qty: 1 }], { payment: { momo: 45, momo_txn_id: "TX123" } });
    expect(r.status).toBe("completed");
  });

  it("splits cash and MoMo", async () => {
    const r = await sell(attendant, [{ product_id: milo, qty: 1 }], {
      payment: { cash: 50, momo: 20, momo_txn_id: "TX9" },
    });
    expect(r.change_given).toBe(25);
  });

  it("rejects hidden products", async () => {
    await asAdmin(db);
    const hidden = await makeProduct(db, owner, { name: "Old stock", is_active: false, opening_stock: 5 });
    await expect(sell(attendant, [{ product_id: hidden, qty: 1 }])).rejects.toThrow(/no longer for sale/);
  });

  it("users waiting for approval cannot sell", async () => {
    const pending = await createUser(db, "Pending Person", null);
    await expect(sell(pending, [{ product_id: milo, qty: 1 }])).rejects.toThrow(/Only approved staff/);
  });
});

describe("credit", () => {
  it("credit within the limit completes and raises the balance", async () => {
    const r = await sell(attendant, [{ product_id: water, pack_id: bagId, qty: 5 }], {
      customer,
      payment: { credit: 40 },
    });
    expect(r.status).toBe("completed");
    await asAdmin(db);
    const [c] = await rowsOf<{ balance: string }>(db, "select balance from public.customers where id = $1", [customer]);
    expect(c.balance).toBe("40.00");
  });

  it("credit needs a customer", async () => {
    await expect(sell(attendant, [{ product_id: water, qty: 1 }], { payment: { credit: 0.3 } })).rejects.toThrow(
      /Choose a customer/,
    );
  });

  it("attendant going over the limit puts the sale on hold, with no stock change", async () => {
    const before = await stockOf(db, water);
    await expect(
      sell(attendant, [{ product_id: water, pack_id: bagId, qty: 2 }], { customer, payment: { credit: 16 } }),
    ).rejects.toThrow(/Give a reason/);

    const r = await sell(attendant, [{ product_id: water, pack_id: bagId, qty: 2 }], {
      customer,
      payment: { credit: 16 },
      note: "Regular customer, pays Friday",
    });
    expect(r.status).toBe("held_for_approval");
    expect(r.approval_request_id).not.toBeNull();
    expect(await stockOf(db, water)).toBe(before);
    await asAdmin(db);
    const [c] = await rowsOf<{ balance: string }>(db, "select balance from public.customers where id = $1", [customer]);
    expect(c.balance).toBe("40.00");
    const [req] = await rowsOf<{ type: string; status: string; payload: { sale_id: string; reason: string } }>(
      db,
      "select type, status, payload from public.approval_requests where id = $1",
      [r.approval_request_id],
    );
    expect(req).toMatchObject({ type: "credit_over_limit", status: "pending" });
    expect(req.payload).toMatchObject({ sale_id: r.sale_id, reason: "Regular customer, pays Friday" });
  });

  it("the owner can sell over the limit straight away (and it is audited)", async () => {
    const r = await sell(owner, [{ product_id: water, pack_id: bagId, qty: 2 }], { customer, payment: { credit: 16 } });
    expect(r.status).toBe("completed");
    await asUser(db, owner);
    const logs = await rowsOf(db, "select * from public.audit_logs where action = 'sale_with_override' and entity_id = $1", [
      r.sale_id,
    ]);
    expect(logs).toHaveLength(1);
  });
});

describe("discounts", () => {
  it("attendant discount needs approval", async () => {
    const r = await sell(attendant, [{ product_id: milo, qty: 1 }], { discount: 5, note: "Damaged tin", payment: { cash: 40 } });
    expect(r.status).toBe("held_for_approval");
    expect(r.total).toBe(40);
  });

  it("owner discount completes", async () => {
    const r = await sell(owner, [{ product_id: milo, qty: 1 }], { discount: 5, payment: { cash: 40 } });
    expect(r.status).toBe("completed");
    expect(r.discount).toBe(5);
  });

  it("discount can't be more than the sale", async () => {
    await expect(sell(owner, [{ product_id: milo, qty: 1 }], { discount: 50 })).rejects.toThrow(/Discount must be/);
  });
});

describe("double taps and privacy", () => {
  it("the same client reference is only sold once", async () => {
    const ref = randomUUID();
    const before = await stockOf(db, water);
    const first = await sell(attendant, [{ product_id: water, qty: 3 }], { ref });
    const second = await sell(attendant, [{ product_id: water, qty: 3 }], { ref });
    expect(second.sale_id).toBe(first.sale_id);
    expect(await stockOf(db, water)).toBe(before - 3);
  });

  it("attendants can only open their own receipts", async () => {
    const r = await sell(attendant, [{ product_id: water, qty: 1 }]);
    await asUser(db, attendant2);
    await expect(call(db, "public.sale_receipt($1)", [r.sale_id])).rejects.toThrow(/only see your own/);
    await asUser(db, owner);
    expect((await call<Receipt>(db, "public.sale_receipt($1)", [r.sale_id])).sale_id).toBe(r.sale_id);
  });

  it("apply_sale_effects can't be called through the API", async () => {
    const r = await sell(attendant, [{ product_id: water, qty: 1 }]);
    await asUser(db, owner);
    await expect(call(db, "public.apply_sale_effects($1)", [r.sale_id])).rejects.toThrow(/permission denied/);
  });

  it("the ledger matches stock for every product", async () => {
    await asAdmin(db);
    const mismatches = await rowsOf(
      db,
      `select p.name from public.products p
        left join public.stock_movements m on m.product_id = p.id
        group by p.id having p.stock_units <> coalesce(sum(m.change_units), 0)`,
    );
    expect(mismatches).toEqual([]);
  });
});
