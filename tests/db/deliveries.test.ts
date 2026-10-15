// Phase 6: record_delivery, confirm_delivery, delivery_details.
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, makeProduct, rowsOf, stockOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let water: string;
let bag: string;
let supplier: string;

type Details = {
  status: string;
  items: { id: string; qty: number; units: number; cost_per_unit: number | null; cost_is_set: boolean | null }[];
};

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
  water = await makeProduct(db, owner, {
    name: "Sachet water",
    base_unit_name: "sachet",
    cost_per_unit: "0.18",
    packs: [{ name: "Bag", units_per_pack: 30, retail_price: 8, wholesale_price: 7 }],
  });
  await asAdmin(db);
  [{ id: bag }] = await rowsOf<{ id: string }>(db, "select id from public.product_packs where product_id = $1", [water]);
  await asUser(db, attendant);
  [{ id: supplier }] = await rowsOf<{ id: string }>(db, "insert into public.suppliers (name) values ('Voltic Depot') returning id");
}, 60_000);

describe("attendant receives goods", () => {
  let deliveryId: string;

  it("stock goes up at once and the delivery waits for the owner", async () => {
    await asUser(db, attendant);
    const r = await call<{ delivery_id: string; status: string }>(db, "public.record_delivery($1, $2, $3)", [
      supplier,
      [{ product_id: water, pack_id: bag, qty: 10, cost_per_unit: 0.01 }],
      `${attendant}/invoice-1.webp`,
    ]);
    deliveryId = r.delivery_id;
    expect(r.status).toBe("pending_check");
    expect(await stockOf(db, water)).toBe(300);
  });

  it("attendants cannot set costs (the cost they sent is ignored)", async () => {
    await asAdmin(db);
    expect(await rowsOf(db, "select * from public.delivery_item_costs")).toEqual([]);
    const [c] = await rowsOf<{ cost_per_unit: string }>(db, "select cost_per_unit from public.product_costs where product_id = $1", [water]);
    expect(c.cost_per_unit).toBe("0.1800");
  });

  it("attendants can't attach someone else's invoice photo", async () => {
    await asUser(db, attendant);
    await expect(
      call(db, "public.record_delivery($1, $2, $3)", [supplier, [{ product_id: water, qty: 1 }], `${attendant2}/x.webp`]),
    ).rejects.toThrow(/Invalid invoice photo/);
  });

  it("the receiver sees the delivery without costs; other attendants can't", async () => {
    await asUser(db, attendant);
    const d = await call<Details>(db, "public.delivery_details($1)", [deliveryId]);
    expect(d.items[0]).toMatchObject({ qty: 10, units: 300, cost_per_unit: null });
    await asUser(db, attendant2);
    await expect(call(db, "public.delivery_details($1)", [deliveryId])).rejects.toThrow(/only see your own/);
  });

  it("owner confirms with costs; product cost updates", async () => {
    await asUser(db, owner);
    const d = await call<Details>(db, "public.delivery_details($1)", [deliveryId]);
    expect(d.items[0]).toMatchObject({ cost_per_unit: 0.18, cost_is_set: false });
    await db.query("select public.confirm_delivery($1, $2, 'confirmed')", [
      deliveryId,
      [{ delivery_item_id: d.items[0].id, cost_per_unit: 0.2 }],
    ]);
    const after = await call<Details>(db, "public.delivery_details($1)", [deliveryId]);
    expect(after.status).toBe("confirmed");
    expect(after.items[0]).toMatchObject({ cost_per_unit: 0.2, cost_is_set: true });
    const [c] = await rowsOf<{ cost_per_unit: string }>(db, "select cost_per_unit from public.product_costs where product_id = $1", [water]);
    expect(c.cost_per_unit).toBe("0.2000");
  });

  it("a confirmed delivery can't be confirmed again", async () => {
    await asUser(db, owner);
    await expect(db.query("select public.confirm_delivery($1, '[]', 'confirmed')", [deliveryId])).rejects.toThrow(
      /already confirmed/,
    );
  });
});

describe("queries and owner deliveries", () => {
  it("querying needs a note", async () => {
    await asUser(db, attendant);
    const r = await call<{ delivery_id: string }>(db, "public.record_delivery($1, $2)", [supplier, [{ product_id: water, qty: 5 }]]);
    await asUser(db, owner);
    await expect(db.query("select public.confirm_delivery($1, '[]', 'queried')", [r.delivery_id])).rejects.toThrow(
      /Say what is wrong/,
    );
    await db.query("select public.confirm_delivery($1, '[]', 'queried', '2 bags missing')", [r.delivery_id]);
    const d = await call<Details & { note: string }>(db, "public.delivery_details($1)", [r.delivery_id]);
    expect(d.status).toBe("queried");
    expect(d.note).toContain("Owner: 2 bags missing");
  });

  it("only the owner can confirm", async () => {
    await asUser(db, attendant);
    const r = await call<{ delivery_id: string }>(db, "public.record_delivery($1, $2)", [supplier, [{ product_id: water, qty: 1 }]]);
    await expect(db.query("select public.confirm_delivery($1, '[]', 'confirmed')", [r.delivery_id])).rejects.toThrow(
      /Only the owner/,
    );
  });

  it("owner's delivery with all costs is confirmed straight away, with the right cost snapshot", async () => {
    await asUser(db, owner);
    const r = await call<{ delivery_id: string; status: string }>(db, "public.record_delivery(null, $1)", [
      [{ product_id: water, pack_id: bag, qty: 1, cost_per_unit: 0.25 }],
    ]);
    expect(r.status).toBe("confirmed");
    const [m] = await rowsOf<{ unit_cost: string }>(
      db,
      "select unit_cost from public.stock_movements where ref_id = $1",
      [r.delivery_id],
    );
    expect(m.unit_cost).toBe("0.2500");
  });

  it("the same client reference only adds stock once", async () => {
    const ref = randomUUID();
    const before = await stockOf(db, water);
    await asUser(db, attendant);
    await call(db, "public.record_delivery($1, $2, null, null, $3)", [supplier, [{ product_id: water, qty: 7 }], ref]);
    await call(db, "public.record_delivery($1, $2, null, null, $3)", [supplier, [{ product_id: water, qty: 7 }], ref]);
    expect(await stockOf(db, water)).toBe(before + 7);
  });
});
