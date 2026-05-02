# Workspace

## Overview

pnpm workspace monorepo using TypeScript. YouTube Analytics Dashboard — a dark-first mission control for tracking 5 YouTube channels with 30 days of sample data.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### YouTube Analytics Dashboard (`artifacts/data-app`)
- **Kind**: data-app (React + Vite)
- **Preview path**: `/`
- **Routes**: `/` (Overview), `/channels/:channelId` (Channel deep-dive)
- **Theme**: Dark-first (defaults to dark mode on load)

#### Features
- KPI cards: subscribers, views, watch hours, revenue, engagement rate (with growth % badges)
- Cross-channel trends chart (area + line, 30 days)
- Channel leaderboard with proportional bar indicators
- Top channel callouts (most viewed, fastest growing)
- Per-channel deep-dive: daily views area chart, subscribers line chart, revenue bar chart
- Sortable, filterable video table with pagination (@tanstack/react-table)
- CSV export per chart card (react-csv)
- PDF export (window.print())
- Auto-refresh with configurable intervals (30s, 1m, 5m)
- Dark/light mode toggle

#### Key Files
- `artifacts/data-app/src/App.tsx` — routes, QueryClient, DarkModeEnforcer
- `artifacts/data-app/src/pages/overview.tsx` — Overview dashboard page
- `artifacts/data-app/src/pages/channel.tsx` — Channel deep-dive page
- `artifacts/data-app/src/components/layout/Sidebar.tsx` — Nav sidebar with live channel list
- `artifacts/data-app/src/components/dashboard/kpi-card.tsx` — KPI card with growth badge
- `artifacts/data-app/src/components/dashboard/charts.tsx` — CustomTooltip, CustomLegend
- `artifacts/data-app/src/components/dashboard/controls.tsx` — Refresh, PDF, dark mode, date range controls
- `artifacts/data-app/src/components/dashboard/video-table.tsx` — Sortable video table
- `artifacts/data-app/src/lib/formatters.ts` — formatCompact, formatCurrency, formatPercent, formatDate, CHART_COLORS

### API Server (`artifacts/api-server`)
- **Kind**: api
- **Base path**: `/api`
- **Routes**: `/api/channels`, `/api/overview`, `/api/overview/trends`, `/api/channels/:id/metrics`, `/api/channels/:id/videos`
- **Data**: Rich sample data for 5 channels (MKBHD, Linus Tech Tips, The Verge, iFixit, GamersNexus) with 30 days of generated daily metrics

#### Key Files
- `artifacts/api-server/src/routes/youtube.ts` — all YouTube analytics routes + sample data

## API Contract

OpenAPI spec lives in `lib/api-spec/openapi.yaml`. Generated hooks and Zod schemas are in:
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `lib/api-client-react/src/generated/api.schemas.ts` — TypeScript interfaces
- `lib/api-zod/src/generated/api.ts` — Zod validation schemas

Re-generate with: `pnpm --filter @workspace/api-spec run codegen`

## Channels Tracked
1. MKBHD (ch_mkbhd) — red accent
2. Linus Tech Tips (ch_linus) — yellow accent
3. The Verge (ch_verge) — pink accent
4. iFixit (ch_ifixit) — green accent
5. GamersNexus (ch_gamersnexus) — purple accent
