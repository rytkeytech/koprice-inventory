// Phase 3: save_product and import_products.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asUser, call, createShop, makeProduct, rowsOf, stockOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;

beforeAll(async () => {
  ({ db, owner, attendant } = await createShop());
}, 60_000);

describe("save_product", () => {
  let waterId: string;

  it("creates a product with packs, cost and opening stock in one go", async () => {
    waterId = await makeProduct(db, owner, {
      name: "Sachet water",
      base_unit_name: "sachet",
      retail_price: "0.30",
      wholesale_price: "0.25",
      cost_per_unit: "0.1833",
      opening_stock: 600,
      packs: [
        { name: "Bag", units_per_pack: 30, retail_price: "8.00", wholesale_price: "7.00", min_wholesale_qty: 5 },
      ],
    });
    expect(await stockOf(db, waterId)).toBe(600);
    await asAdmin(db);
    const [movement] = await rowsOf<{ reason: string; unit_cost: string; user_id: string }>(
      db,
      "select reason, unit_cost, user_id from public.stock_movements where product_id = $1",
      [waterId],
    );
    expect(movement).toEqual({ reason: "opening_stock", unit_cost: "0.1833", user_id: owner });
    const packs = await rowsOf(
      db,
      "select name, units_per_pack from public.product_packs where product_id = $1",
      [waterId],
    );
    expect(packs).toEqual([{ name: "Bag", units_per_pack: 30 }]);
  });

  it("updates prices and packs without touching stock", async () => {
    await asAdmin(db);
    const [pack] = await rowsOf<{ id: string }>(
      db,
      "select id from public.product_packs where product_id = $1",
      [waterId],
    );
    await makeProduct(db, owner, {
      id: waterId,
      name: "Sachet water",
      base_unit_name: "sachet",
      retail_price: "0.35",
      wholesale_price: "0.25",
      opening_stock: 9999,
      packs: [{ id: pack.id, name: "Bag", units_per_pack: 30, retail_price: "9.00", wholesale_price: "7.50" }],
    });
    expect(await stockOf(db, waterId)).toBe(600);
    await asAdmin(db);
    const [p] = await rowsOf<{ retail_price: string }>(
      db,
      "select retail_price from public.products where id = $1",
      [waterId],
    );
    expect(p.retail_price).toBe("0.35");
    const [pk] = await rowsOf<{ retail_price: string }>(
      db,
      "select retail_price from public.product_packs where id = $1",
      [pack.id],
    );
    expect(pk.retail_price).toBe("9.00");
  });

  it("is all-or-nothing: a bad pack cancels the whole save", async () => {
    await asUser(db, owner);
    await expect(
      call(db, "public.save_product($1)", [
        {
          name: "Broken item",
          retail_price: 1,
          wholesale_price: 1,
          opening_stock: 10,
          packs: [{ name: "Box", units_per_pack: 1, retail_price: 1, wholesale_price: 1 }],
        },
      ]),
    ).rejects.toThrow(/units_per_pack/);
    await asAdmin(db);
    expect(await rowsOf(db, "select * from public.products where name = 'Broken item'")).toEqual([]);
  });

  it("attendants cannot save products", async () => {
    await asUser(db, attendant);
    await expect(
      call(db, "public.save_product($1)", [{ name: "X", retail_price: 1, wholesale_price: 1 }]),
    ).rejects.toThrow(/Only the owner/);
  });
});

describe("import_products", () => {
  it("creates new products with 'import' stock movements and updates existing ones", async () => {
    await asUser(db, owner);
    const result = await call<{ created: number; updated: number; stock_not_changed: string[] }>(
      db,
      "public.import_products($1)",
      [
        [
          {
            row_number: 2,
            name: "Milo tin 400g",
            category: "provisions",
            base_unit: "tin",
            barcode: "111",
            cost_per_unit: "35",
            retail_price: "45",
            wholesale_price: "42",
            opening_stock_units: 48,
            quick_sell: true,
            packs: [{ name: "Carton", units_per_pack: 24, retail_price: "1000", wholesale_price: "960" }],
          },
          {
            row_number: 3,
            name: "SACHET WATER",
            category: "Water",
            base_unit: "sachet",
            retail_price: "0.40",
            wholesale_price: "0.30",
            opening_stock_units: 50,
            packs: [{ name: "bag", units_per_pack: 30, retail_price: "10", wholesale_price: "8" }],
          },
        ],
      ],
    );
    expect(result).toEqual({ created: 1, updated: 1, stock_not_changed: ["Sachet water"] });

    await asAdmin(db);
    const [milo] = await rowsOf<{ id: string; stock_units: number; is_quick_sell: boolean }>(
      db,
      "select id, stock_units, is_quick_sell from public.products where barcode = '111'",
    );
    expect(milo.stock_units).toBe(48);
    expect(milo.is_quick_sell).toBe(true);
    const [m] = await rowsOf<{ reason: string }>(
      db,
      "select reason from public.stock_movements where product_id = $1",
      [milo.id],
    );
    expect(m.reason).toBe("import");
    // The existing "Bag" pack is matched by name (any case), not duplicated.
    const bags = await rowsOf<{ retail_price: string }>(
      db,
      `select pp.retail_price from public.product_packs pp
       join public.products p on p.id = pp.product_id where p.name = 'SACHET WATER'`,
    );
    expect(bags).toEqual([{ retail_price: "10.00" }]);
  });

  it("stops the whole import on a bad row and says which row", async () => {
    await asUser(db, owner);
    await expect(
      call(db, "public.import_products($1)", [
        [
          { row_number: 2, name: "Good item", category: "Water", retail_price: 1, wholesale_price: 1 },
          { row_number: 3, name: "Bad item", category: "Shoes", retail_price: 1, wholesale_price: 1 },
        ],
      ]),
    ).rejects.toThrow(/Row 3: unknown category "Shoes"/);
    await asAdmin(db);
    expect(await rowsOf(db, "select * from public.products where name = 'Good item'")).toEqual([]);
  });

  it("rejects a missing price with the row number", async () => {
    await asUser(db, owner);
    await expect(
      call(db, "public.import_products($1)", [
        [{ row_number: 7, name: "No price", category: "Water", wholesale_price: 1 }],
      ]),
    ).rejects.toThrow(/Row 7:.*retail_price/);
  });

  it("logs the import in the audit log", async () => {
    await asUser(db, owner);
    const logs = await rowsOf(
      db,
      "select * from public.audit_logs where entity = 'products' and action = 'import'",
    );
    expect(logs).toHaveLength(1);
  });
});
