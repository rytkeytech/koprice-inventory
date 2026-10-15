# CLAUDE.md — Koprice Inventory & Sales System

Client project by **RYT KEY TECH** (Annor Sampson) for **Koprice Enterprise** (owner: Prince Akoto), a wholesale + retail mini supermarket in Ghana.

**The full plan is in `docs/BUILD_SPEC.md`. Read it before starting any phase.**

## What this app is for
The owner works elsewhere and visits the shop only sometimes. Attendants sell on shop-owned phones/tablets (no fixed counter). The #1 goal is **tracking every sale and every stock movement so the owner can detect loss** (missing stock, missing cash, fake discounts, deleted sales) from his phone.

## Stack (do not change)
Next.js 16 (App Router) · React · TypeScript (strict) · Tailwind CSS · Supabase (Postgres, Auth, Storage) · `@supabase/supabase-js` + `@supabase/ssr`. Host-agnostic: will deploy to **Netlify**, so **no Vercel-only packages or `vercel.json`**.

## Hard rules
1. **Database is the final authority.** Every money or stock change happens inside a Postgres function (RPC) in one transaction. Never update `stock_units`, balances or totals from client code.
2. **Prices come from the database, not the client.** `complete_sale` looks up prices itself; the client only sends product/pack ids, quantities and price mode.
3. **Every stock change writes a row to `stock_movements`.** No exceptions. This ledger is how missing stock is detected.
4. **Attendants never see cost prices or profit.** Cost lives in `product_costs`, readable by owner only.
5. **Attendants cannot**: edit prices, give discounts or credit over limit, refund, delete or edit sales, delete anything, confirm deliveries or cash-ups. They can only *request* these (approval_requests).
6. **Nothing is ever hard-deleted** for sales, movements, payments, cash-ups, audit logs. Use status fields.
7. **RLS on every table.** Default deny. Test policies as both roles.
8. **Never seed demo/sample data into the real database.** Sample data only in `supabase/seed.local.sql`, never run against the remote project.
9. **Never print, log, commit or ask for secrets.** Keys live in `.env.local` (git-ignored) and the host's env settings. Do not ask the user to paste keys into chat.
10. **Migrations**: write SQL as files in `supabase/migrations/`. Do **not** run destructive SQL (DROP, TRUNCATE, DELETE, ALTER … DROP) against the remote project. Stop and tell the user what to run and why, and wait.
11. **Money**: store as `numeric(12,2)` in GH₵. Quantities in **base units** as `integer`. Never use floats for money.
12. **Work one phase at a time** (see BUILD_SPEC §10). At the end of each phase: `npm run lint`, `npm run typecheck`, `npm run build` must pass; then commit with a clear message; then summarise what was done and the manual test checklist for that phase.
13. **No repairs module.** This is not GENXCHOICE. Do not add repairs tables, pages or functions.
14. Keep the UI simple, professional and phone-first, matching the design tokens in BUILD_SPEC §8. Plain English labels.

## Commands
- `npm run dev`: local dev
- `npm run lint` / `npm run typecheck` / `npm run build`: must pass before every commit
- `npm test`: unit tests (Vitest) for pricing/unit-conversion helpers

## User context
The developer (Annor) is still learning; explain changes in simple, practical words. When something needs doing in the Supabase dashboard, give exact click locations and say whether it is safe or destructive.
