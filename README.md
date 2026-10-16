# Koprice Inventory & Sales

Inventory and sales system for **Koprice Enterprise**, a wholesale and retail
mini supermarket in Esreso Ophilia, Ghana. Built by RYT KEY TECH.

Attendants sell on shop phones; the owner watches sales, stock, cash and
missing stock from anywhere. The full plan is in [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md).

**Stack:** Next.js 16 · React · TypeScript · Tailwind CSS · Supabase (Postgres,
Auth, Storage). Hosted on Netlify.

---

## 1. Run it on your computer

1. Install **Node.js 24** or newer.
2. In the project folder: `npm install`
3. Copy `.env.example` to `.env.local` and fill in the two values from the
   Supabase dashboard (**Project Settings → API Keys** and **Data API**):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   Never put the secret / service-role key anywhere in this project.
4. `npm run dev`, then open http://localhost:3000

## 2. Database changes (migrations)

All database tables, rules and functions are SQL files in
[supabase/migrations](supabase/migrations). See [supabase/README.md](supabase/README.md).

To apply new migrations to the real database, in the VS Code terminal:

```
npx supabase db push
```

Answer **Y**. It only applies files that haven't been applied yet.
(First time on a new computer: `npx supabase login`, then
`npx supabase link --project-ref <your project ref>`.)

After applying, refresh the TypeScript types: `npm run db:types`.

## 3. First owner account

1. Sign up in the app with your email.
2. Make that account the owner (one time only), replacing `YOUR-EMAIL`:

   ```
   npx supabase db query --linked "update public.profiles set role = 'owner', approved_at = now() where id = (select id from auth.users where email = 'YOUR-EMAIL')"
   ```

3. Everyone else signs up in the app and the owner approves them in
   **Settings → Staff**.

### Supabase Auth settings (dashboard)

- **Authentication → Sign In / Providers → Email:** turn **Confirm email** off
  (the owner approves every account anyway, and the free email limit is very low).
- **Authentication → URL Configuration:** set **Site URL** to the live app
  address, and add `http://localhost:3000/**` and `https://<your-site>.netlify.app/**`
  under **Redirect URLs** (needed for password-reset links).

## 4. Deploy to Netlify

1. Push the code to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub** and pick
   this repository. Build settings come from [netlify.toml](netlify.toml).
3. **Site configuration → Environment variables:** add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (same values as `.env.local`). Then **Deploys → Trigger deploy**.
4. Add the Netlify address to Supabase **Redirect URLs** (see above).
5. On each shop phone: open the site in Chrome → menu → **Add to Home screen**.

## 5. Backups and keep-alive (GitHub Actions)

Two scheduled jobs live in [.github/workflows](.github/workflows):

| Job | When | What |
|---|---|---|
| **Nightly backup** | 00:30 every night | Dumps roles, schema and data and commits them to a separate **private** repo |
| **Keep database awake** | 06:00 every day | Runs one read-only query so the free Supabase project never pauses |

Setup (once):

1. Create a new **private** GitHub repository, e.g. `koprice-backups`.
2. Create a fine-grained token (GitHub → Settings → Developer settings →
   Fine-grained tokens) with **Contents: Read and write** on that repo only.
3. In this repo: **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL`: Supabase → **Connect** → **Session pooler** connection
     string, with your database password filled in
   - `BACKUP_REPO`: e.g. `rytkeytech/koprice-backups`
   - `BACKUP_REPO_TOKEN`: the token from step 2
4. **Actions** tab → **Nightly backup** → **Run workflow** to test it.

GitHub pauses scheduled jobs in repositories with no commits for 60 days. If
that happens, open the **Actions** tab and re-enable them.

**Restoring** (into a new, empty Supabase project, only in an emergency):

```
psql "<new project connection string>" -f latest/roles.sql
psql "<new project connection string>" -f latest/schema.sql
psql "<new project connection string>" -c "SET session_replication_role = replica" -f latest/data.sql
```

The owner can also download any period as Excel from **Reports**.

## 6. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Production build |
| `npm test` | Unit tests + database security tests (in-memory Postgres; never touches the real database) |
| `npm run db:types` | Regenerate database types after migrations |
| `npm run template` | Rebuild the Excel import template |
| `npm run icons` | Rebuild the app icons |
| `npm run guide` | Rebuild the user guide PDF (`public/guides/`) from `scripts/guide-content.mjs` |

## 7. How loss is tracked (summary)

- Every stock change is a row in `stock_movements`; stock can't change any other way.
- Prices, totals, change, expected cash and shortages are worked out by the
  database, not typed in.
- Attendants can't see cost or profit, give discounts, refund, cancel, delete,
  or go over credit limits. They can only ask; the owner approves.
- Sales, payments, cash-ups and the audit log are never deleted.
- Stock counts are blind for attendants, and missing stock is valued at cost.
