/**
 * Tiny Postgres-backed key/value store with graceful degradation:
 * if DATABASE_URL is unset, all reads return null and writes are no-ops.
 *
 * Used to persist OAuth refresh tokens + the imported channel list across
 * cold starts on free hosting tiers (Render free wipes filesystem on restart).
 */
import pg from "pg";
import { logger } from "./logger";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _initialized = false;

function getPool(): pg.Pool | null {
  if (_pool) return _pool;
  const url = process.env["DATABASE_URL"];
  if (!url) return null;
  _pool = new Pool({
    connectionString: url,
    // Neon and most managed Postgres want SSL; Pool will negotiate.
    ssl: url.includes("sslmode=require") || url.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 3,
  });
  _pool.on("error", (err) => {
    logger.error({ err }, "Postgres pool error");
  });
  return _pool;
}

async function ensureSchema(): Promise<void> {
  if (_initialized) return;
  const pool = getPool();
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  _initialized = true;
}

export function isPersistenceEnabled(): boolean {
  return !!process.env["DATABASE_URL"];
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    await ensureSchema();
    const res = await pool.query<{ value: T }>(
      "SELECT value FROM kv_store WHERE key = $1",
      [key],
    );
    return res.rows[0]?.value ?? null;
  } catch (err) {
    logger.warn({ err, key }, "kvGet failed");
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO kv_store (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
  } catch (err) {
    logger.warn({ err, key }, "kvSet failed");
  }
}

export async function kvDelete(key: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await ensureSchema();
    await pool.query("DELETE FROM kv_store WHERE key = $1", [key]);
  } catch (err) {
    logger.warn({ err, key }, "kvDelete failed");
  }
}
