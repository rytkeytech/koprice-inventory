// Phase 11: expenses and shop settings permissions.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createShop, rowsOf } from "./test-db";

let db: PGlite;
let owner: string;
let attendant: string;
let attendant2: string;

beforeAll(async () => {
  ({ db, owner, attendant, attendant2 } = await createShop());
}, 60_000);

describe("expenses", () => {
  let pendingId: string;

  it("owner's own expense is confirmed and stamped at once", async () => {
    await asUser(db, owner);
    const [e] = await rowsOf<{ status: string; confirmed_by: string; confirmed_at: string | null }>(
      db,
      "insert into public.expenses (category, amount, status, note) values ('rent', 500, 'confirmed', 'October') returning status, confirmed_by, confirmed_at",
    );
    expect(e.status).toBe("confirmed");
    expect(e.confirmed_by).toBe(owner);
    expect(e.confirmed_at).not.toBeNull();
  });

  it("attendant expenses wait for the owner and can't be stamped by the attendant", async () => {
    await asUser(db, attendant);
    [{ id: pendingId }] = await rowsOf<{ id: string }>(
      db,
      "insert into public.expenses (category, amount, note) values ('transport', 20, 'Taxi to depot') returning id",
    );
    await db.query("update public.expenses set status = 'confirmed' where id = $1", [pendingId]);
    const [e] = await rowsOf<{ status: string }>(db, "select status from public.expenses where id = $1", [pendingId]);
    expect(e.status).toBe("pending");
  });

  it("owner confirms; who and when are stamped by the database", async () => {
    await asUser(db, owner);
    await db.query("update public.expenses set status = 'rejected' where id = $1", [pendingId]);
    const [e] = await rowsOf<{ status: string; confirmed_by: string }>(db, "select status, confirmed_by from public.expenses where id = $1", [pendingId]);
    expect(e).toEqual({ status: "rejected", confirmed_by: owner });
  });

  it("attendants see only their own expenses; nobody deletes them", async () => {
    await asUser(db, attendant2);
    expect(await rowsOf(db, "select * from public.expenses")).toEqual([]);
    await asUser(db, owner);
    await expect(db.query("delete from public.expenses")).rejects.toThrow(/permission denied/);
  });

  it("expense changes are audited", async () => {
    await asUser(db, owner);
    const logs = await rowsOf(db, "select * from public.audit_logs where entity = 'expenses'");
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });
});

describe("shop settings", () => {
  it("only the owner edits shop details", async () => {
    await asUser(db, attendant);
    await db.query("update public.shop_settings set shop_name = 'Hacked'");
    await asUser(db, owner);
    await db.query("update public.shop_settings set momo_number = '0240000000', momo_name = 'Koprice'");
    const [s] = await rowsOf<{ shop_name: string; momo_number: string }>(db, "select shop_name, momo_number from public.shop_settings");
    expect(s).toEqual({ shop_name: "Koprice Enterprise", momo_number: "0240000000" });
  });

  it("attendants can read shop details for receipts", async () => {
    await asUser(db, attendant);
    const [s] = await rowsOf<{ momo_number: string }>(db, "select momo_number from public.shop_settings");
    expect(s.momo_number).toBe("0240000000");
  });
});
