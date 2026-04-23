# MLabs AI — Marketing Intelligence Platform

Multi-tenant SaaS for marketing intelligence. Users sign in with Google, connect their Google Business Profile (and more connectors over time), and get unified insights on calls, directions, reviews, and local visibility. Built for multi-location brands and agencies.

**Live:** https://app.mlabsdigital.org
**Company:** [MLabs Digital](https://mlabsdigital.org)

## Stack
Next.js 15.2.4 · TypeScript strict · Tailwind · Supabase (Postgres + Auth + RLS) · Vercel (bom1)

## Features (V1 Part 1)
- Google OAuth sign-in
- Connect Google Business Profile via OAuth
- Manual location entry (while GBP Basic Access is pending approval)
- Overview dashboard with KPIs, trend chart, top locations, recent reviews
- Locations tab: sortable table, Excel export, click-to-filter
- Reviews tab: grouped by location, star distribution, star filter
- Cross-tab filter via URL query params
- AES-256-GCM encryption of OAuth tokens at rest
- Row Level Security for multi-tenant isolation

## Roadmap
- V1 Part 2: Competitor selection
- V1 Part 3: AI Insights (6 tabs, Gemini 2.5 Pro)
- V2: Meta Ads, Google Ads, GA4, GSC, LinkedIn connectors
- V2.1: Stripe billing for Pro tier
- V3: Multi-client workspaces for agencies

## GTM
Enterprise and agency sales-first (₹25k–₹2L/mo). Free tier is a funnel, not a revenue driver in year 1. Self-serve Pro and Stripe come later.

## Local dev
```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — TS check
- `npm run lint` — ESLint
- `npm run test:unit` — Vitest
- `npm run test:e2e` — Playwright
- `npm run test` — typecheck + lint + unit

## Migrations
Apply manually via Supabase SQL editor. Numbered in `supabase/migrations/`.

## Deployment
Auto-deploys from `main` branch via Vercel. Env vars in Project Settings. Region: bom1 (Mumbai).

## Health check
`GET /api/health` returns env + DB connectivity. Status 200 = healthy, 503 = degraded.
