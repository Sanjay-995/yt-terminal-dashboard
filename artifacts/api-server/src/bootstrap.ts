import { logger } from "./lib/logger";
import {
  hydrateFromRefreshToken,
  isConnected,
  getChannelByHandle,
} from "./lib/youtube-client";
import { addOrUpdateYouTubeChannel, clearSeedChannels } from "./routes/youtube";
import { kvGet, isPersistenceEnabled } from "./lib/kv-store";

const KV_REFRESH_TOKEN = "youtube:refresh_token";
const KV_CHANNEL_HANDLES = "youtube:channel_handles";

/**
 * On startup, hydrate state so the dashboard works across cold restarts
 * without re-OAuthing.
 *
 * Order of precedence:
 *   1. Postgres (DATABASE_URL) — fully automatic persistence
 *   2. Env vars (YOUTUBE_REFRESH_TOKEN, YOUTUBE_CHANNEL_HANDLES) — manual fallback
 */
export async function bootstrapState(): Promise<void> {
  // ─── Refresh token ──────────────────────────────────────────────────────────
  let refresh: string | null = null;

  if (isPersistenceEnabled()) {
    refresh = await kvGet<string>(KV_REFRESH_TOKEN);
    if (refresh) logger.info("Hydrated YouTube refresh token from Postgres");
  }
  if (!refresh) {
    refresh = process.env["YOUTUBE_REFRESH_TOKEN"]?.trim() ?? null;
    if (refresh) logger.info("Hydrated YouTube refresh token from env");
  }
  if (refresh) {
    hydrateFromRefreshToken(refresh);
  }

  // ─── Channel handles ────────────────────────────────────────────────────────
  let handles: string[] | null = null;

  if (isPersistenceEnabled()) {
    handles = await kvGet<string[]>(KV_CHANNEL_HANDLES);
    if (handles) logger.info({ count: handles.length }, "Loaded channel handles from Postgres");
  }
  if (!handles) {
    const handlesEnv = process.env["YOUTUBE_CHANNEL_HANDLES"]?.trim();
    if (handlesEnv) {
      handles = handlesEnv.split(",").map((h) => h.trim()).filter(Boolean);
      logger.info({ count: handles.length }, "Loaded channel handles from env");
    }
  }

  if (!handles || handles.length === 0) {
    logger.info("No channel handles to auto-import");
    return;
  }

  if (!isConnected()) {
    logger.warn("Channel handles present but no OAuth token — auto-import skipped");
    return;
  }

  clearSeedChannels();

  let imported = 0;
  let failed = 0;
  for (const handle of handles) {
    try {
      const yt = await getChannelByHandle(handle);
      if (!yt) {
        logger.warn({ handle }, "auto-import: channel not found");
        failed += 1;
        continue;
      }
      addOrUpdateYouTubeChannel(yt);
      imported += 1;
    } catch (err) {
      logger.warn({ handle, err }, "auto-import: fetch failed");
      failed += 1;
    }
  }

  logger.info({ imported, failed, total: handles.length }, "Channel auto-import complete");
}
