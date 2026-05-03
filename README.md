# YouTube Analytics Dashboard

A dark-first mission control dashboard for tracking YouTube channel analytics. Monitors 5 channels with 30 days of metrics, including subscribers, views, watch hours, revenue, and engagement rate.

## Project Structure

This is a pnpm monorepo with two main services:

| Service | Directory | Description |
|---|---|---|
| Frontend (React + Vite) | `artifacts/data-app` | Dashboard UI |
| Backend (Express API) | `artifacts/api-server` | REST API server |

## Prerequisites

- **Node.js** v24+
- **pnpm** v9+

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

## Installing Dependencies

From the repo root, install all workspace dependencies at once:

```bash
pnpm install
```

## Required Secrets

The following environment variables must be set for the API server. `ACCESS_CODE` and `ZERNIO_API_KEY` are validated on each relevant request; `SESSION_SECRET` is reserved for session signing middleware and should be set even if not yet wired up:

| Secret | Required | Description |
|---|---|---|
| `ACCESS_CODE` | Yes | Passcode shown on the dashboard lock screen |
| `SESSION_SECRET` | Yes | Secret used to sign sessions; use a long, random string (e.g. 64+ characters) |
| `ZERNIO_API_KEY` | Yes | Bearer token for the [Zernio](https://zernio.com) social analytics API |

Generate a strong `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Running on Replit (recommended)

On Replit, `PORT` and `BASE_PATH` are injected automatically, and a shared reverse proxy routes `/api` requests to the API server. Add the three secrets above via the **Replit Secrets panel**, then start both workflows. The dashboard will be available in the preview pane.

## Running Locally (outside Replit)

> **Note:** This app is designed to run on Replit. Running it locally requires a workaround because the frontend uses same-origin relative `/api/...` URLs — in production these are handled by the Replit reverse proxy, but locally you must configure the Vite dev server to proxy those requests to the API server.

### Step 1 — Add a Vite proxy (local workaround)

Add a `proxy` entry to the `server` block in `artifacts/data-app/vite.config.ts`:

```ts
server: {
  port,
  strictPort: true,
  host: "0.0.0.0",
  allowedHosts: true,
  proxy: {
    "/api": "http://localhost:3001",
  },
  fs: { strict: true },
},
```

### Step 2 — Start the API server

```bash
export ACCESS_CODE=your-passcode
export SESSION_SECRET=your-long-random-secret
export ZERNIO_API_KEY=your-zernio-key
export PORT=3001
pnpm --filter @workspace/api-server run dev
```

The API will be available at `http://localhost:3001/api`.

### Step 3 — Start the frontend

```bash
export PORT=3000
export BASE_PATH=/
pnpm --filter @workspace/data-app run dev
```

The dashboard will be available at `http://localhost:3000/`. Browser requests to `/api/...` will be proxied to the API server at port 3001.

## Environment Variables Reference

| Variable | Service | Required | Description |
|---|---|---|---|
| `PORT` | Both | Yes | Port to listen on — no default, must be set explicitly |
| `BASE_PATH` | Frontend | Yes | URL base path for the app (use `/` locally) |
| `ACCESS_CODE` | API server | Yes | Passcode that protects the dashboard lock screen |
| `SESSION_SECRET` | API server | Yes | Secret used to sign sessions |
| `ZERNIO_API_KEY` | API server | Yes | Bearer token for the Zernio social analytics API |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/auth/verify` | Verify access code |
| `GET` | `/api/overview` | Aggregated KPI metrics across all channels |
| `GET` | `/api/overview/trends` | 30-day daily trend data for all channels |
| `GET` | `/api/channels` | List of all tracked channels |
| `GET` | `/api/channels/:id/metrics` | Per-channel KPI metrics |
| `GET` | `/api/channels/:id/videos` | Video list for a channel |
| `GET` | `/api/zernio/accounts` | Live social accounts from Zernio (requires `ZERNIO_API_KEY`) |

## Useful Commands

```bash
# Full typecheck across all packages
pnpm run typecheck

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push database schema changes (dev only)
pnpm --filter @workspace/db run push
```

## Channels Tracked

The dashboard ships with 30 days of sample data for these 5 channels:

1. **MKBHD** — Marques Brownlee (tech reviews)
2. **Linus Tech Tips** — LTT Media
3. **The Verge** — tech news
4. **iFixit** — repair guides
5. **GamersNexus** — hardware benchmarks
