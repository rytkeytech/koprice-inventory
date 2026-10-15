import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const here = import.meta.dirname;
const root = join(here, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

/** Fresh in-memory Postgres with the Supabase stub and all migrations applied. */
export async function createTestDb() {
  const db = await PGlite.create();
  await db.exec(readFileSync(join(here, "supabase-stub.sql"), "utf8"));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

/** Act as the database admin (like the Supabase SQL Editor). No logged-in user. */
export async function asAdmin(db: PGlite) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

/** Act as a logged-in user, the way requests from the app arrive. */
export async function asUser(db: PGlite, userId: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
}

/** Act as a visitor who is not logged in. */
export async function asAnon(db: PGlite) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role anon");
}

/** Creates an auth user (the signup trigger makes the profile) and sets a role. */
export async function createUser(
  db: PGlite,
  fullName: string,
  role: "owner" | "attendant" | null,
) {
  await asAdmin(db);
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`${fullName.toLowerCase().replace(/\s+/g, ".")}@example.test`, { full_name: fullName }],
  );
  const id = rows[0].id;
  if (role) {
    await db.query("update public.profiles set role = $1 where id = $2", [role, id]);
  }
  return id;
}

/** A fresh database with an owner and two attendants, ready for tests. */
export async function createShop() {
  const db = await createTestDb();
  const owner = await createUser(db, "Prince Owner", "owner");
  const attendant = await createUser(db, "Ama Attendant", "attendant");
  const attendant2 = await createUser(db, "Kofi Attendant", "attendant");
  return { db, owner, attendant, attendant2 };
}

/** Runs a query and returns its rows. */
export async function rowsOf<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
) {
  return (await db.query<T>(sql, params)).rows;
}

/** Calls a database function that returns one value (e.g. jsonb or uuid). */
export async function call<T = unknown>(db: PGlite, sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ result: T }>(`select ${sql} as result`, params);
  return rows[0].result;
}

/** Owner creates a product (and optional packs/cost/opening stock). Returns its id. */
export async function makeProduct(db: PGlite, owner: string, product: Record<string, unknown>) {
  await asUser(db, owner);
  return call<string>(db, "public.save_product($1)", [
    { retail_price: 1, wholesale_price: 1, ...product },
  ]);
}

/** Current stock of a product, read as admin. */
export async function stockOf(db: PGlite, productId: string) {
  await asAdmin(db);
  const [row] = await rowsOf<{ stock_units: number }>(
    db,
    "select stock_units from public.products where id = $1",
    [productId],
  );
  return row.stock_units;
}
