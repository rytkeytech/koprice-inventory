# Koprice Inventory & Sales

Inventory and sales system for Koprice Enterprise. Built by RYT KEY TECH.
The full plan is in [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md).

## Setup

1. Install Node.js 24 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
4. `npm run dev` and open http://localhost:3000

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run icons` | Regenerate PWA icons in `public/icons/` |
