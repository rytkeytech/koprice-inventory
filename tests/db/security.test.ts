// Database security tests (Phase 1).
// Runs the real migrations in an in-memory Postgres (PGlite) and checks the
// rules from CLAUDE.md / BUILD_SPEC as owner, attendant, pending user and anon.
// Nothing here touches the real Supabase project.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asAnon, asUser, createTestDb, createUser } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;
let pending: string;
let productId: string;

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

async function stockOf(id: string) {
  await asAdmin(db);
  const [row] = await rows<{ stock_units: number }>(
    "select stock_units from public.products where id = $1",
    [id],
  );
  return row.stock_units;
}

/** Inserts a sale the way a future RPC would (as admin). */
async function insertSale(attendantId: string, total: number) {
  await asAdmin(db);
  const [sale] = await rows<{ id: string; receipt_no: string }>(
    `insert into public.sales (attendant_id, price_mode, subtotal, total, paid_cash)
     values ($1, 'retail', $2, $2, $2) returning id, receipt_no`,
    [attendantId, total],
  );
  const [item] = await rows<{ id: string }>(
    `insert into public.sale_items (sale_id, product_id, qty, units, unit_price, line_total)
     values ($1, $2, 1, 1, $3, $3) returning id`,
    [sale.id, productId, total],
  );
  await db.query(
    `insert into public.sale_item_costs (sale_item_id, sale_id, product_id, unit_cost, cost_total)
     values ($1, $2, $3, 0.1833, 0.18)`,
    [item.id, sale.id, productId],
  );
  return sale;
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db, "Prince Owner", "owner");
  attendant = await createUser(db, "Ama Attendant", "attendant");
  attendant2 = await createUser(db, "Kofi Attendant", "attendant");
  pending = await createUser(db, "New Signup", null);

  // Owner creates a product and its cost through the normal table API.
  await asUser(db, owner);
  const [category] = await rows<{ id: string }>(
    "select id from public.categories where name = 'Water'",
  );
  const [product] = await rows<{ id: string }>(
    `insert into public.products (name, category_id, base_unit_name, barcode, retail_price, wholesale_price)
     values ('Sachet water', $1, 'sachet', '6001234567890', 0.30, 0.25) returning id`,
    [category.id],
  );
  productId = product.id;
  await db.query(
    "insert into public.product_costs (product_id, cost_per_unit) values ($1, 0.1833)",
    [productId],
  );
}, 60_000);

describe("migrations and starting data", () => {
  it("creates the single shop settings row and 10 categories", async () => {
    await asAdmin(db);
    expect(await rows("select * from public.shop_settings")).toHaveLength(1);
    expect(await rows("select * from public.categories")).toHaveLength(10);
  });

  it("enables RLS on every public table", async () => {
    await asAdmin(db);
    const tables = await rows<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(tables).toEqual([]);
  });

  it("creates storage buckets", async () => {
    await asAdmin(db);
    const buckets = await rows<{ id: string; public: boolean }>(
      "select id, public from storage.buckets order by id",
    );
    expect(buckets).toEqual([
      { id: "invoices", public: false },
      { id: "product-photos", public: true },
    ]);
  });
});

describe("sign-up and roles", () => {
  it("new sign-ups get a profile with no role", async () => {
    await asAdmin(db);
    const [profile] = await rows<{ role: string | null; full_name: string }>(
      "select role, full_name from public.profiles where id = $1",
      [pending],
    );
    expect(profile).toEqual({ role: null, full_name: "New Signup" });
  });

  it("a user waiting for approval sees no products or categories", async () => {
    await asUser(db, pending);
    expect(await rows("select * from public.products")).toEqual([]);
    expect(await rows("select * from public.categories")).toEqual([]);
  });

  it("anon (not logged in) has no table access at all", async () => {
    await asAnon(db);
    await expect(rows("select * from public.products")).rejects.toThrow(/permission denied/);
    await expect(rows("select * from public.profiles")).rejects.toThrow(/permission denied/);
  });

  it("attendant can edit own name but not own role", async () => {
    await asUser(db, attendant);
    await db.query("update public.profiles set full_name = 'Ama A.' where id = $1", [attendant]);
    await expect(
      db.query("update public.profiles set role = 'owner' where id = $1", [attendant]),
    ).rejects.toThrow(/permission denied/);
  });

  it("attendant sees only own profile; owner sees all", async () => {
    await asUser(db, attendant);
    expect(await rows("select id from public.profiles")).toEqual([{ id: attendant }]);
    await asUser(db, owner);
    expect((await rows("select id from public.profiles")).length).toBe(4);
  });

  it("a deactivated attendant loses access", async () => {
    await asAdmin(db);
    await db.query("update public.profiles set is_active = false where id = $1", [attendant2]);
    await asUser(db, attendant2);
    expect(await rows("select * from public.products")).toEqual([]);
    await asAdmin(db);
    await db.query("update public.profiles set is_active = true where id = $1", [attendant2]);
  });
});

describe("cost prices are owner only", () => {
  it("attendant cannot read product_costs; owner can", async () => {
    await asUser(db, attendant);
    expect(await rows("select * from public.product_costs")).toEqual([]);
    await asUser(db, owner);
    const [cost] = await rows<{ cost_per_unit: string }>(
      "select cost_per_unit from public.product_costs",
    );
    expect(cost.cost_per_unit).toBe("0.1833");
  });

  it("attendant can read products (no cost columns on products)", async () => {
    await asUser(db, attendant);
    const [product] = await rows<Record<string, unknown>>("select * from public.products");
    expect(product.name).toBe("Sachet water");
    expect(Object.keys(product).some((k) => k.includes("cost"))).toBe(false);
  });
});

describe("prices and stock cannot be changed from the app", () => {
  it("attendant cannot change a price", async () => {
    await asUser(db, attendant);
    await db.query("update public.products set retail_price = 0.01 where id = $1", [productId]);
    await asAdmin(db);
    const [p] = await rows<{ retail_price: string }>(
      "select retail_price from public.products where id = $1",
      [productId],
    );
    expect(p.retail_price).toBe("0.30");
  });

  it("nobody can update stock_units through the API (attendant or owner)", async () => {
    for (const user of [attendant, owner]) {
      await asUser(db, user);
      await expect(
        db.query("update public.products set stock_units = 999 where id = $1", [productId]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("owner cannot create a product with stock already in it", async () => {
    await asUser(db, owner);
    await expect(
      db.query(
        "insert into public.products (name, retail_price, wholesale_price, stock_units) values ('X', 1, 1, 50)",
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("even the admin cannot change stock without a stock movement", async () => {
    await asAdmin(db);
    await expect(
      db.query("update public.products set stock_units = 999 where id = $1", [productId]),
    ).rejects.toThrow(/only change through a stock movement/);
  });

  it("attendant cannot write stock movements directly", async () => {
    await asUser(db, attendant);
    await expect(
      db.query(
        "insert into public.stock_movements (product_id, change_units, reason) values ($1, 100, 'delivery')",
        [productId],
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await rows("select * from public.stock_movements")).toEqual([]);
  });
});

describe("stock ledger", () => {
  it("a movement updates stock and records balance and cost", async () => {
    await asAdmin(db);
    const [m] = await rows<{ balance_after: number; unit_cost: string }>(
      `insert into public.stock_movements (product_id, change_units, reason)
       values ($1, 300, 'opening_stock') returning balance_after, unit_cost`,
      [productId],
    );
    expect(m).toEqual({ balance_after: 300, unit_cost: "0.1833" });
    expect(await stockOf(productId)).toBe(300);

    await db.query(
      "insert into public.stock_movements (product_id, change_units, reason) values ($1, -60, 'sale')",
      [productId],
    );
    expect(await stockOf(productId)).toBe(240);
  });

  it("stock can't go negative", async () => {
    await asAdmin(db);
    await expect(
      db.query(
        "insert into public.stock_movements (product_id, change_units, reason) values ($1, -1000, 'sale')",
        [productId],
      ),
    ).rejects.toThrow(/Not enough stock for Sachet water: 240 in stock, 1000 needed/);
    expect(await stockOf(productId)).toBe(240);
  });

  it("the direction must match the reason", async () => {
    await asAdmin(db);
    await expect(
      db.query(
        "insert into public.stock_movements (product_id, change_units, reason) values ($1, 5, 'sale')",
        [productId],
      ),
    ).rejects.toThrow(/stock_movements_direction/);
  });

  it("movements can never be edited or deleted", async () => {
    await asAdmin(db);
    await expect(db.query("update public.stock_movements set change_units = 1")).rejects.toThrow(
      /not allowed/,
    );
    await expect(db.query("delete from public.stock_movements")).rejects.toThrow(/not allowed/);
    await expect(db.query("truncate public.stock_movements")).rejects.toThrow(/not allowed/);
  });

  it("owner can read the ledger; attendant cannot", async () => {
    await asUser(db, owner);
    expect((await rows("select * from public.stock_movements")).length).toBe(2);
    await asUser(db, attendant);
    expect(await rows("select * from public.stock_movements")).toEqual([]);
  });
});

describe("sales", () => {
  it("receipt numbers look like KP-000001", async () => {
    const sale = await insertSale(attendant, 3);
    expect(sale.receipt_no).toMatch(/^KP-\d{6}$/);
    await insertSale(attendant2, 6);
  });

  it("attendants see only their own sales; owner sees all", async () => {
    await asUser(db, attendant);
    expect((await rows("select * from public.sales")).length).toBe(1);
    expect((await rows("select * from public.sale_items")).length).toBe(1);
    await asUser(db, owner);
    expect((await rows("select * from public.sales")).length).toBe(2);
  });

  it("attendants cannot see sale costs; owner can", async () => {
    await asUser(db, attendant);
    expect(await rows("select * from public.sale_item_costs")).toEqual([]);
    await asUser(db, owner);
    expect((await rows("select * from public.sale_item_costs")).length).toBe(2);
  });

  it("nobody can insert, edit or delete sales through the API", async () => {
    for (const user of [attendant, owner]) {
      await asUser(db, user);
      await expect(db.query("update public.sales set total = 0")).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.sales")).rejects.toThrow(/permission denied/);
      await expect(
        db.query(
          "insert into public.sales (price_mode, subtotal, total, paid_cash) values ('retail', 1, 1, 1)",
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("even the admin cannot delete a sale", async () => {
    await asAdmin(db);
    await expect(db.query("delete from public.sales")).rejects.toThrow(/not allowed/);
  });

  it("sale totals must add up", async () => {
    await asAdmin(db);
    await expect(
      db.query(
        `insert into public.sales (attendant_id, price_mode, subtotal, discount, total, paid_cash)
         values ($1, 'retail', 10, 2, 10, 10)`,
        [attendant],
      ),
    ).rejects.toThrow(/sales_total_math/);
    await expect(
      db.query(
        `insert into public.sales (attendant_id, price_mode, subtotal, total, paid_cash)
         values ($1, 'retail', 10, 10, 5)`,
        [attendant],
      ),
    ).rejects.toThrow(/sales_payment_math/);
  });
});

describe("customers and credit limits", () => {
  it("attendant can add a customer with no credit, but not set a limit", async () => {
    await asUser(db, attendant);
    await db.query("insert into public.customers (name, phone) values ('Auntie Esi', '0240000000')");
    await expect(
      db.query("insert into public.customers (name, credit_limit) values ('Big Buyer', 500)"),
    ).rejects.toThrow(/row-level security/);
  });

  it("attendant cannot raise a credit limit or set a balance", async () => {
    await asUser(db, attendant);
    await db.query("update public.customers set credit_limit = 1000");
    await expect(db.query("update public.customers set balance = 0")).rejects.toThrow(
      /permission denied/,
    );
    await asAdmin(db);
    const [c] = await rows<{ credit_limit: string }>("select credit_limit from public.customers");
    expect(c.credit_limit).toBe("0.00");
  });

  it("owner can set a credit limit", async () => {
    await asUser(db, owner);
    await db.query("update public.customers set credit_limit = 200 where name = 'Auntie Esi'");
    const [c] = await rows<{ credit_limit: string }>("select credit_limit from public.customers");
    expect(c.credit_limit).toBe("200.00");
  });
});

describe("audit log", () => {
  it("owner price changes are logged with old and new values", async () => {
    await asUser(db, owner);
    await db.query("update public.products set retail_price = 0.35 where id = $1", [productId]);
    const logs = await rows<{ user_id: string; details: Record<string, unknown> }>(
      `select user_id, details from public.audit_logs
       where entity = 'products' and action = 'update' and entity_id = $1`,
      [productId],
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].user_id).toBe(owner);
    expect(logs[0].details).toEqual({ retail_price: { old: 0.3, new: 0.35 } });
  });

  it("stock changes are not duplicated in the audit log (the ledger has them)", async () => {
    await asAdmin(db);
    const logs = await rows(
      "select * from public.audit_logs where entity = 'products' and details ? 'stock_units' and action = 'update'",
    );
    expect(logs).toEqual([]);
  });

  it("attendant cannot read the audit log", async () => {
    await asUser(db, attendant);
    expect(await rows("select * from public.audit_logs")).toEqual([]);
  });

  it("the audit log can never be edited or deleted", async () => {
    await asUser(db, owner);
    await expect(db.query("delete from public.audit_logs")).rejects.toThrow(/permission denied/);
    await asAdmin(db);
    await expect(db.query("delete from public.audit_logs")).rejects.toThrow(/not allowed/);
    await expect(db.query("update public.audit_logs set action = 'x'")).rejects.toThrow(
      /not allowed/,
    );
  });
});

describe("other rules", () => {
  it("a barcode can't be used by both a product and a pack", async () => {
    await asUser(db, owner);
    await expect(
      db.query(
        `insert into public.product_packs (product_id, name, units_per_pack, barcode, retail_price, wholesale_price)
         values ($1, 'Bag', 30, '6001234567890', 8, 7)`,
        [productId],
      ),
    ).rejects.toThrow(/already used by a product/);
  });

  it("attendant expenses must be pending", async () => {
    await asUser(db, attendant);
    await db.query("insert into public.expenses (category, amount) values ('transport', 20)");
    await expect(
      db.query(
        "insert into public.expenses (category, amount, status) values ('transport', 20, 'confirmed')",
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cash-up shortage is calculated by the database", async () => {
    await asAdmin(db);
    const [c] = await rows<{ shortage: string }>(
      `insert into public.cash_ups (attendant_id, expected_cash, handover_method, amount_handed,
                                    status, confirmed_amount, confirmed_at)
       values ($1, 500, 'safe', 480, 'short', 480, now()) returning shortage`,
      [attendant],
    );
    expect(c.shortage).toBe("20.00");
  });

  it("only one cash-up per attendant per day", async () => {
    await asAdmin(db);
    await expect(
      db.query(
        "insert into public.cash_ups (attendant_id, handover_method, amount_handed) values ($1, 'safe', 0)",
        [attendant],
      ),
    ).rejects.toThrow(/cash_ups_one_per_day/);
  });

  it("staff upload invoices only into their own folder", async () => {
    await asUser(db, attendant);
    await db.query(
      "insert into storage.objects (bucket_id, name) values ('invoices', $1)",
      [`${attendant}/delivery-1.jpg`],
    );
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('invoices', $1)", [
        `${attendant2}/delivery-1.jpg`,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("attendants can't see other attendants' invoices; owner sees all", async () => {
    await asUser(db, attendant2);
    expect(await rows("select * from storage.objects where bucket_id = 'invoices'")).toEqual([]);
    await asUser(db, owner);
    expect(
      (await rows("select * from storage.objects where bucket_id = 'invoices'")).length,
    ).toBe(1);
  });

  it("only the owner uploads product photos", async () => {
    await asUser(db, attendant);
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('product-photos', 'x.jpg')"),
    ).rejects.toThrow(/row-level security/);
    await asUser(db, owner);
    await db.query("insert into storage.objects (bucket_id, name) values ('product-photos', 'x.jpg')");
  });
});
