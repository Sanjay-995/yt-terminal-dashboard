import { Router, type IRouter } from "express";
import {
  GetChannelsResponse,
  GetChannelMetricsParams,
  GetChannelVideosParams,
  GetOverviewTrendsQueryParams,
} from "@workspace/api-zod";
import {
  isConnected,
  getRealMetrics,
  getRealVideos,
  getOwnedChannelIds,
  getRecentVideoStats,
} from "../lib/youtube-client";
import type { YouTubeChannel, DailyMetric } from "../lib/youtube-client";

const router: IRouter = Router();

// ─── Platforms ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "youtube",   name: "YouTube",   color: "#FF0000", supportsAnalytics: true,  supportsRevenue: true  },
  { id: "tiktok",    name: "TikTok",    color: "#010101", supportsAnalytics: true,  supportsRevenue: true  },
  { id: "instagram", name: "Instagram", color: "#E1306C", supportsAnalytics: true,  supportsRevenue: false },
  { id: "twitter",   name: "X/Twitter", color: "#000000", supportsAnalytics: true,  supportsRevenue: false },
  { id: "twitch",    name: "Twitch",    color: "#9146FF", supportsAnalytics: true,  supportsRevenue: true  },
  { id: "facebook",  name: "Facebook",  color: "#1877F2", supportsAnalytics: true,  supportsRevenue: false },
  { id: "linkedin",  name: "LinkedIn",  color: "#0A66C2", supportsAnalytics: true,  supportsRevenue: false },
  { id: "pinterest", name: "Pinterest", color: "#E60023", supportsAnalytics: false, supportsRevenue: false },
];

// ─── Channel store ────────────────────────────────────────────────────────────
//
// All time-windowed metrics (subscriberGrowth30d, viewsGrowth30d,
// engagementRate, totalWatchTimeHours) are NULL by default. They are filled
// only by code paths that have a real source (Analytics API for OAuth'd
// channels, Data API recent video stats for engagementRate). We never
// fabricate a placeholder number — null tells the UI to render "—".

interface Channel {
  id: string;
  name: string;
  handle: string;
  platform: string;
  url: string;
  avatarColor: string;
  subscribers: number;
  totalViews: number;
  totalVideos: number;
  totalWatchTimeHours: number | null;
  avgViewsPerVideo: number;
  subscriberGrowth30d: number | null;
  viewsGrowth30d: number | null;
  engagementRate: number | null;
  youtubeChannelId?: string; // set for channels linked to real YouTube data
}

// No mock seed channels. The dashboard starts empty and is populated by
// the OAuth flow / handle-import endpoint with real public stats.
let channels: Channel[] = [];

/**
 * Add or update a channel imported from a real YouTube account.
 * Exported so the OAuth route can call it without circular imports.
 *
 * Public stats (subscribers, totalViews, totalVideos) are real for every
 * imported channel. Time-windowed fields stay null — we fill them only when
 * Analytics API or Data API recent-video sampling can produce real numbers.
 */
export function addOrUpdateYouTubeChannel(ytCh: YouTubeChannel): Channel {
  const existing = channels.findIndex((c) => c.youtubeChannelId === ytCh.id);

  const channel: Channel = {
    id: existing >= 0 ? channels[existing]!.id : `ch_yt_${ytCh.id}`,
    name: ytCh.name,
    handle: ytCh.handle,
    platform: "youtube",
    url: `https://youtube.com/${ytCh.handle}`,
    avatarColor: existing >= 0 ? channels[existing]!.avatarColor : "#FF0000",
    subscribers: ytCh.subscribers,
    totalViews: ytCh.totalViews,
    totalVideos: ytCh.totalVideos,
    totalWatchTimeHours: null, // requires Analytics API; null until/unless filled
    avgViewsPerVideo:
      ytCh.totalVideos > 0 ? Math.round(ytCh.totalViews / ytCh.totalVideos) : 0,
    subscriberGrowth30d: null,
    viewsGrowth30d: null,
    engagementRate: null,
    youtubeChannelId: ytCh.id,
  };

  if (existing >= 0) {
    channels[existing] = channel;
  } else {
    channels.push(channel);
  }

  return channel;
}

/**
 * Remove seed/mock channels (those without a linked YouTube ID).
 * Returns the number removed.
 */
export function clearSeedChannels(): number {
  const before = channels.length;
  channels = channels.filter((c) => c.youtubeChannelId !== undefined);
  return before - channels.length;
}

export interface ZernioChannelInput {
  zernioId: string;
  platform: string;
  name: string;
  handle: string;
  url: string;
  avatarColor: string;
  followers: number;
}

const bareHandle = (h: string) => h.replace(/^@/, "").toLowerCase();

/**
 * Add (or refresh) a channel sourced from a connected Zernio account —
 * Instagram, or a YouTube channel not already tracked via direct OAuth.
 *
 * YouTube accounts that duplicate an OAuth-tracked channel (same handle) are
 * skipped: the OAuth version carries richer Analytics (revenue, daily metrics),
 * so we keep it rather than shadow it with a follower-only Zernio copy.
 *
 * Returns { added: true } when a NEW channel row was created (vs. refreshed/skipped).
 */
export function addOrUpdateZernioChannel(z: ZernioChannelInput): { added: boolean; skipped: boolean } {
  if (z.platform === "youtube") {
    const dup = channels.some(
      (c) =>
        c.platform === "youtube" &&
        c.youtubeChannelId !== undefined &&
        bareHandle(c.handle) === bareHandle(z.handle),
    );
    if (dup) return { added: false, skipped: true };
  }

  const id = `zernio_${z.zernioId}`;
  const existing = channels.findIndex((c) => c.id === id);
  const channel: Channel = {
    id,
    name: z.name,
    handle: z.handle,
    platform: z.platform,
    url: z.url,
    avatarColor: z.avatarColor,
    subscribers: z.followers,
    totalViews: 0,
    totalVideos: 0,
    totalWatchTimeHours: null,
    avgViewsPerVideo: 0,
    subscriberGrowth30d: null,
    viewsGrowth30d: null,
    engagementRate: null,
  };

  if (existing >= 0) {
    channels[existing] = channel;
    return { added: false, skipped: false };
  }
  channels.push(channel);
  return { added: true, skipped: false };
}

// ─── Request validation ───────────────────────────────────────────────────────

interface CreateChannelBody {
  name: string;
  handle: string;
  platform: string;
  avatarColor: string;
  url?: string;
  subscribers?: number;
  totalViews?: number;
  totalVideos?: number;
}

interface UpdateChannelBody {
  name?: string;
  handle?: string;
  platform?: string;
  avatarColor?: string;
  url?: string;
  subscribers?: number;
  totalViews?: number;
  totalVideos?: number;
}

function validateCreate(
  body: unknown
): { ok: true; data: CreateChannelBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  if (!b["name"] || typeof b["name"] !== "string") return { ok: false, error: "name is required" };
  if (!b["handle"] || typeof b["handle"] !== "string") return { ok: false, error: "handle is required" };
  if (!b["platform"] || typeof b["platform"] !== "string") return { ok: false, error: "platform is required" };
  if (!b["avatarColor"] || typeof b["avatarColor"] !== "string") return { ok: false, error: "avatarColor is required" };
  return {
    ok: true,
    data: {
      name: b["name"] as string,
      handle: b["handle"] as string,
      platform: b["platform"] as string,
      avatarColor: b["avatarColor"] as string,
      url: typeof b["url"] === "string" ? b["url"] : undefined,
      subscribers: typeof b["subscribers"] === "number" ? Math.round(b["subscribers"]) : 0,
      totalViews: typeof b["totalViews"] === "number" ? Math.round(b["totalViews"]) : 0,
      totalVideos: typeof b["totalVideos"] === "number" ? Math.round(b["totalVideos"]) : 0,
    },
  };
}

function validateUpdate(body: unknown): UpdateChannelBody {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  const out: UpdateChannelBody = {};
  if (typeof b["name"] === "string") out.name = b["name"];
  if (typeof b["handle"] === "string") out.handle = b["handle"];
  if (typeof b["platform"] === "string") out.platform = b["platform"];
  if (typeof b["avatarColor"] === "string") out.avatarColor = b["avatarColor"];
  if (typeof b["url"] === "string") out.url = b["url"];
  if (typeof b["subscribers"] === "number") out.subscribers = Math.round(b["subscribers"]);
  if (typeof b["totalViews"] === "number") out.totalViews = Math.round(b["totalViews"]);
  if (typeof b["totalVideos"] === "number") out.totalVideos = Math.round(b["totalVideos"]);
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Decorate a stored Channel with the per-request hasAnalyticsAccess flag,
 * which depends on the live OAuth state (whether the connected account owns
 * this YouTube channel ID).
 */
function decorate(ch: Channel, ownedIds: Set<string>) {
  return {
    ...ch,
    hasAnalyticsAccess: !!ch.youtubeChannelId && ownedIds.has(ch.youtubeChannelId),
  };
}

/**
 * Fetch real engagement rate for a channel from recent video stats. Cached
 * in-memory for ENGAGEMENT_TTL_MS to avoid hammering the Data API on every
 * /overview request. Returns null when no OAuth token, no uploads, or on
 * upstream error — never a fabricated value.
 */
const ENGAGEMENT_TTL_MS = 10 * 60_000;
const _engagementCache = new Map<string, { value: number | null; at: number }>();

async function fetchEngagementRate(ytChannelId: string): Promise<number | null> {
  const cached = _engagementCache.get(ytChannelId);
  if (cached && Date.now() - cached.at < ENGAGEMENT_TTL_MS) {
    return cached.value;
  }
  try {
    const stats = await getRecentVideoStats(ytChannelId, 10);
    const value = stats?.engagementRate ?? null;
    _engagementCache.set(ytChannelId, { value, at: Date.now() });
    return value;
  } catch {
    return null;
  }
}

/**
 * Compute real 30D windowed totals for the connected channel(s) by summing
 * the daily Analytics API rows. Returns null when no channel has Analytics
 * access or every Analytics call fails.
 */
async function computeRealOverviewWindow(
  oauthChannels: Channel[],
): Promise<{
  totalViews30d: number;
  totalWatchTimeHours30d: number;
  totalEstimatedRevenue30d: number;
  subscriberGrowth30d: number;
  viewsGrowth30d: number | null;
  revenueGrowth30d: number | null;
} | null> {
  if (oauthChannels.length === 0) return null;

  // We pull 60 days so we can compute growth as last-30 vs prior-30.
  const allMetrics: DailyMetric[][] = [];
  for (const ch of oauthChannels) {
    if (!ch.youtubeChannelId) continue;
    try {
      const m = await getRealMetrics(ch.youtubeChannelId, 60);
      allMetrics.push(m);
    } catch {
      // honest skip — don't fabricate
    }
  }
  if (allMetrics.length === 0) return null;

  // Aggregate across channels and split into the two 30-day windows.
  const sumWindow = (rows: DailyMetric[]) =>
    rows.reduce(
      (acc, r) => ({
        views: acc.views + r.views,
        watchTimeHours: acc.watchTimeHours + r.watchTimeHours,
        revenue: acc.revenue + r.estimatedRevenue,
        subs: acc.subs + r.subscribers,
      }),
      { views: 0, watchTimeHours: 0, revenue: 0, subs: 0 },
    );

  const last30: DailyMetric[] = [];
  const prev30: DailyMetric[] = [];
  for (const series of allMetrics) {
    // Series sorted ascending by day; last `days` entries are the most recent.
    const tail = series.slice(-30);
    const head = series.slice(-60, -30);
    last30.push(...tail);
    prev30.push(...head);
  }

  const last = sumWindow(last30);
  const prev = sumWindow(prev30);

  const pctChange = (a: number, b: number): number | null => {
    if (b <= 0) return null; // avoid /0 spikes; null = "not enough history"
    return Math.round(((a - b) / b) * 1000) / 10;
  };

  return {
    totalViews30d: last.views,
    totalWatchTimeHours30d: Math.round(last.watchTimeHours * 10) / 10,
    totalEstimatedRevenue30d: Math.round(last.revenue * 100) / 100,
    subscriberGrowth30d: last.subs,
    viewsGrowth30d: pctChange(last.views, prev.views),
    revenueGrowth30d: pctChange(last.revenue, prev.revenue),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/platforms", (_req, res) => {
  res.json(PLATFORMS);
});

router.get("/channels", async (_req, res): Promise<void> => {
  const ownedIds = isConnected() ? await getOwnedChannelIds() : new Set<string>();

  // Best-effort engagement rate from recent videos (real Data API call) for
  // every linked channel. Cached so this is cheap on warm caches.
  const decorated = await Promise.all(
    channels.map(async (ch) => {
      const base = decorate(ch, ownedIds);
      if (base.engagementRate === null && base.youtubeChannelId && isConnected()) {
        base.engagementRate = await fetchEngagementRate(base.youtubeChannelId);
      }
      return base;
    }),
  );

  const parsed = GetChannelsResponse.safeParse(decorated);
  if (!parsed.success) {
    res.status(500).json({ error: "Data validation error" });
    return;
  }
  res.json(parsed.data);
});

router.post("/channels", async (req, res): Promise<void> => {
  const validation = validateCreate(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { name, handle, platform, avatarColor, url, subscribers = 0, totalViews = 0, totalVideos = 0 } =
    validation.data;

  const existing = channels.find(
    (c) => c.handle.toLowerCase() === handle.toLowerCase() && c.platform === platform
  );
  if (existing) {
    res.status(409).json({ error: "A channel with this handle on this platform already exists" });
    return;
  }

  const id = `ch_${platform}_${handle.replace(/[@\s]/g, "").toLowerCase()}_${Date.now()}`;
  const newChannel: Channel = {
    id,
    name,
    handle,
    platform,
    url: url ?? "",
    avatarColor,
    subscribers,
    totalViews,
    totalVideos,
    totalWatchTimeHours: null,
    avgViewsPerVideo: totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0,
    subscriberGrowth30d: null,
    viewsGrowth30d: null,
    engagementRate: null,
  };

  channels.push(newChannel);
  res.status(201).json({ ...newChannel, hasAnalyticsAccess: false });
});

router.get("/channels/:channelId", async (req, res): Promise<void> => {
  const channel = channels.find((c) => c.id === req.params["channelId"]);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const ownedIds = isConnected() ? await getOwnedChannelIds() : new Set<string>();
  const decorated = decorate(channel, ownedIds);
  if (decorated.engagementRate === null && decorated.youtubeChannelId && isConnected()) {
    decorated.engagementRate = await fetchEngagementRate(decorated.youtubeChannelId);
  }
  res.json(decorated);
});

router.patch("/channels/:channelId", async (req, res): Promise<void> => {
  const idx = channels.findIndex((c) => c.id === req.params["channelId"]);
  if (idx === -1) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const body = validateUpdate(req.body);
  const updated = { ...channels[idx]!, ...body };
  if (body.totalViews !== undefined || body.totalVideos !== undefined) {
    updated.avgViewsPerVideo =
      updated.totalVideos > 0 ? Math.round(updated.totalViews / updated.totalVideos) : 0;
  }

  channels[idx] = updated;
  const ownedIds = isConnected() ? await getOwnedChannelIds() : new Set<string>();
  res.json(decorate(updated, ownedIds));
});

router.delete("/channels/:channelId", async (req, res): Promise<void> => {
  const id = req.params["channelId"]!;
  const idx = channels.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  channels.splice(idx, 1);
  res.json({ success: true, id });
});

router.get("/channels/:channelId/metrics", async (req, res): Promise<void> => {
  const params = GetChannelMetricsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const channel = channels.find((c) => c.id === params.data.channelId);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const days = Number(req.query["days"] ?? 30);
  const safeDays = isNaN(days) ? 30 : days;

  // Real Analytics API only — no synthetic fallback. When the connected
  // OAuth account doesn't own this channel, return [] so the UI renders an
  // empty state rather than a fabricated graph.
  if (!channel.youtubeChannelId || !isConnected()) {
    res.json([]);
    return;
  }

  const ownedIds = await getOwnedChannelIds();
  if (!ownedIds.has(channel.youtubeChannelId)) {
    res.json([]);
    return;
  }

  try {
    const metrics = await getRealMetrics(channel.youtubeChannelId, safeDays);
    res.json(metrics);
  } catch (e) {
    req.log.warn({ err: e }, "YouTube Analytics fetch failed");
    res.json([]);
  }
});

router.get("/channels/:channelId/videos", async (req, res): Promise<void> => {
  const params = GetChannelVideosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const channel = channels.find((c) => c.id === params.data.channelId);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const limit = Number(req.query["limit"] ?? 20);
  const safeLimit = isNaN(limit) ? 20 : limit;

  // Real Data API videos for any channel with a linked YouTube ID — works
  // for all imported channels under our app's OAuth token. No synthetic
  // fallback: if we can't resolve real videos, return [].
  if (!channel.youtubeChannelId || !isConnected()) {
    res.json([]);
    return;
  }

  try {
    const videos = await getRealVideos(channel.youtubeChannelId, safeLimit, channel.avatarColor);
    res.json(videos);
  } catch (e) {
    req.log.warn({ err: e }, "YouTube videos fetch failed");
    res.json([]);
  }
});

router.get("/overview", async (_req, res): Promise<void> => {
  const totalChannelCount = channels.length;
  const ownedIds = isConnected() ? await getOwnedChannelIds() : new Set<string>();
  const oauthChannels = channels.filter(
    (c) => !!c.youtubeChannelId && ownedIds.has(c.youtubeChannelId),
  );
  const oauthChannelCount = oauthChannels.length;

  if (totalChannelCount === 0) {
    res.json({
      totalSubscribers: 0,
      totalViews30d: null,
      totalWatchTimeHours30d: null,
      totalEstimatedRevenue30d: null,
      avgEngagementRate: null,
      subscriberGrowth30d: null,
      viewsGrowth30d: null,
      revenueGrowth30d: null,
      topChannelByViews: null,
      topChannelByGrowth: null,
      oauthChannelCount,
      totalChannelCount,
    });
    return;
  }

  // Real subscribers sum (Data API public stat).
  const totalSubscribers = channels.reduce((s, c) => s + c.subscribers, 0);

  // Real per-channel engagement rates from recent video sampling. Only
  // averaged across channels that returned a value — no zero-padding.
  const engagementRates: number[] = [];
  if (isConnected()) {
    await Promise.all(
      channels.map(async (c) => {
        if (!c.youtubeChannelId) return;
        const r = await fetchEngagementRate(c.youtubeChannelId);
        if (r !== null) engagementRates.push(r);
      }),
    );
  }
  const avgEngagementRate =
    engagementRates.length > 0
      ? Math.round(
          (engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length) * 10,
        ) / 10
      : null;

  const window = await computeRealOverviewWindow(oauthChannels);

  // topChannelByViews uses real Data API totalViews — always honest.
  const topByViews = channels.reduce((a, b) => (a.totalViews > b.totalViews ? a : b));

  // topChannelByGrowth needs a real growth signal. We have it only for
  // OAuth'd channels — and only if we have multiple. With a single OAuth'd
  // channel it's a self-pick that misleads, so we return null then.
  let topChannelByGrowth: string | null = null;
  if (oauthChannels.length > 1 && window) {
    // Re-pull per-channel last-30 subs gained to rank fairly.
    const ranked: Array<{ name: string; gained: number }> = [];
    for (const ch of oauthChannels) {
      if (!ch.youtubeChannelId) continue;
      try {
        const m = await getRealMetrics(ch.youtubeChannelId, 30);
        const gained = m.reduce((s, r) => s + r.subscribers, 0);
        ranked.push({ name: ch.name, gained });
      } catch {
        /* skip on error */
      }
    }
    if (ranked.length > 0) {
      ranked.sort((a, b) => b.gained - a.gained);
      topChannelByGrowth = ranked[0]!.name;
    }
  }

  res.json({
    totalSubscribers,
    totalViews30d: window?.totalViews30d ?? null,
    totalWatchTimeHours30d: window?.totalWatchTimeHours30d ?? null,
    totalEstimatedRevenue30d: window?.totalEstimatedRevenue30d ?? null,
    avgEngagementRate,
    subscriberGrowth30d: window?.subscriberGrowth30d ?? null,
    viewsGrowth30d: window?.viewsGrowth30d ?? null,
    revenueGrowth30d: window?.revenueGrowth30d ?? null,
    topChannelByViews: topByViews.name,
    topChannelByGrowth,
    oauthChannelCount,
    totalChannelCount,
  });
});

router.get("/overview/trends", async (req, res): Promise<void> => {
  const queryParams = GetOverviewTrendsQueryParams.safeParse(req.query);
  const days = queryParams.success ? queryParams.data.days : 30;

  // Cross-channel daily trends — only real Analytics API data, summed across
  // OAuth'd channels. With zero OAuth'd channels, return []. With one
  // OAuth'd channel (the common case here — only MindfulHz is connected),
  // the points reflect that single channel honestly.
  if (!isConnected()) {
    res.json([]);
    return;
  }

  const ownedIds = await getOwnedChannelIds();
  const oauthChannels = channels.filter(
    (c) => !!c.youtubeChannelId && ownedIds.has(c.youtubeChannelId),
  );
  if (oauthChannels.length === 0) {
    res.json([]);
    return;
  }

  // Pull each channel's daily metrics, then sum by date.
  const byDate = new Map<
    string,
    { views: number; subs: number; watchTimeHours: number; revenue: number }
  >();

  for (const ch of oauthChannels) {
    if (!ch.youtubeChannelId) continue;
    try {
      const series = await getRealMetrics(ch.youtubeChannelId, days);
      for (const row of series) {
        const cur = byDate.get(row.date) ?? {
          views: 0,
          subs: 0,
          watchTimeHours: 0,
          revenue: 0,
        };
        cur.views += row.views;
        cur.subs += row.subscribers;
        cur.watchTimeHours += row.watchTimeHours;
        cur.revenue += row.estimatedRevenue;
        byDate.set(row.date, cur);
      }
    } catch (e) {
      req.log.warn({ err: e, channelId: ch.id }, "trends: per-channel Analytics fetch failed");
    }
  }

  const trends = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({
      date,
      totalViews: v.views,
      totalSubscribers: v.subs,
      totalWatchTimeHours: Math.round(v.watchTimeHours * 10) / 10,
      totalRevenue: Math.round(v.revenue * 100) / 100,
    }));

  res.json(trends);
});

export default router;
