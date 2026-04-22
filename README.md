# MLabs AI — Marketing Intelligence Platform

Multi-tenant SaaS. Users sign in with Google, connect their Google Business Profile, and get AI-powered insights on calls, directions, reviews, and local visibility.

## Stack
Next.js 15.2.4 · TypeScript strict · Tailwind · Supabase (Postgres + Auth + RLS) · Vercel

## Local dev
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm run test:unit` — Vitest
- `npm run test:e2e` — Playwright
- `npm run test` — typecheck + lint + unit (full local gate before push)

## Phases
- **Prompt 1A** (now): scaffold, tests, CI — no auth, no DB
- **Prompt 1B**: Supabase schema, Google Login, protected dashboard
- **Day 2**: GMB OAuth, Settings tab, location picker
- **Day 3**: Overview metrics, total locations card
- **Day 4**: Locations table, by-date table, click-to-filter, reviews
- **Day 5**: Polish, deploy to app.mlabsdigital.org
