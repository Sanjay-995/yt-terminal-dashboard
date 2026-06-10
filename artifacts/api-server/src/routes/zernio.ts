import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Base host. The OpenAPI spec lists the production server as
// https://zernio.com/api, so v1 endpoints live under https://zernio.com/api/v1.
const ZERNIO_BASE = "https://zernio.com/api/v1";

function zernioHeaders() {
  const key = process.env["ZERNIO_API_KEY"];
  if (!key) throw new Error("ZERNIO_API_KEY not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function hasKey(): boolean {
  const key = process.env["ZERNIO_API_KEY"];
  return !!key && key !== "placeholder-not-used";
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#FF0000",
  instagram: "#E1306C",
  tiktok: "#010101",
  twitter: "#000000",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  twitch: "#9146FF",
  threads: "#000000",
  bluesky: "#1185FE",
};

const AVATAR_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

function pickColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]!;
}

// ─── Zernio response types (subset of the OpenAPI schema we consume) ──────────

interface SocialAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  profileUrl?: string;
  isActive?: boolean;
  followersCount?: number;
  followersLastUpdated?: string;
  metadata?: Record<string, unknown>;
}

interface AccountWithFollowerStats extends SocialAccount {
  currentFollowers?: number;
  growth?: number;
  growthPercentage?: number;
  dataPoints?: number;
}

function displayName(a: SocialAccount): string {
  return a.displayName || a.username || a._id;
}

function handleOf(a: SocialAccount): string {
  const u = a.username ?? "";
  return u.startsWith("@") ? u : `@${u || displayName(a)}`;
}

// ─── Status ───────────────────────────────────────────────────────────────────
// Lets the UI render an honest "configured / connected / analytics add-on"
// state instead of guessing from a failed request.

router.get("/zernio/status", async (_req, res) => {
  if (!hasKey()) {
    res.json({ configured: false, connected: false, hasAnalyticsAccess: false, accountCount: 0 });
    return;
  }
  try {
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, { headers: zernioHeaders() });
    if (!resp.ok) {
      res.json({
        configured: true,
        connected: false,
        hasAnalyticsAccess: false,
        accountCount: 0,
        error: `Zernio API ${resp.status}`,
      });
      return;
    }
    const data = (await resp.json()) as { accounts?: SocialAccount[]; hasAnalyticsAccess?: boolean };
    res.json({
      configured: true,
      connected: true,
      hasAnalyticsAccess: !!data.hasAnalyticsAccess,
      accountCount: (data.accounts ?? []).length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ configured: true, connected: false, hasAnalyticsAccess: false, accountCount: 0, error: message });
  }
});

// ─── Accounts ─────────────────────────────────────────────────────────────────
// Keeps the normalized shape the Settings "Zernio Sync" tab already consumes.

router.get("/zernio/accounts", async (_req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  try {
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, { headers: zernioHeaders() });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.status(resp.status).json({ error: `Failed to fetch Zernio accounts: ${resp.statusText}`, detail: body });
      return;
    }

    const data = (await resp.json()) as { accounts?: SocialAccount[]; hasAnalyticsAccess?: boolean };
    const accounts = data.accounts ?? [];

    const mapped = accounts.map((a, idx) => ({
      id: `zernio_${a._id}`,
      name: displayName(a),
      handle: handleOf(a),
      platform: a.platform,
      url: a.profileUrl ?? "",
      avatarColor: PLATFORM_COLORS[a.platform] ?? pickColor(idx),
      profilePicture: a.profilePicture ?? null,
      subscribers: a.followersCount ?? 0,
      totalViews: 0,
      totalVideos: 0,
      totalWatchTimeHours: null,
      avgViewsPerVideo: 0,
      subscriberGrowth30d: null,
      viewsGrowth30d: null,
      zernioId: a._id,
    }));

    res.json(mapped);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

// ─── Follower stats (the "way more data" win) ─────────────────────────────────
// Historical follower time-series + growth for EVERY connected account — not
// just the single YouTube channel we have direct OAuth Analytics for.

router.get("/zernio/follower-stats", async (req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  const days = Number(req.query["days"] ?? 30);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - safeDays + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;

  const params = new URLSearchParams({
    fromDate: fmt(from),
    toDate: fmt(to),
    granularity: "daily",
  });

  try {
    const resp = await fetch(`${ZERNIO_BASE}/accounts/follower-stats?${params}`, {
      headers: zernioHeaders(),
    });

    if (resp.status === 402 || resp.status === 403) {
      res.status(403).json({
        error: "analytics_addon_required",
        message: "Follower history requires the Zernio Analytics add-on.",
      });
      return;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.status(resp.status).json({ error: `Zernio follower-stats ${resp.status}`, detail: body });
      return;
    }

    const data = (await resp.json()) as {
      accounts?: AccountWithFollowerStats[];
      stats?: Record<string, Array<{ date: string; followers: number }>>;
    };

    const accounts = (data.accounts ?? []).map((a) => ({
      id: `zernio_${a._id}`,
      zernioId: a._id,
      name: displayName(a),
      handle: handleOf(a),
      platform: a.platform,
      currentFollowers: a.currentFollowers ?? a.followersCount ?? 0,
      growth: a.growth ?? null,
      growthPercentage: a.growthPercentage ?? null,
      dataPoints: a.dataPoints ?? 0,
    }));

    // Re-key the per-account series by our prefixed id for frontend lookup.
    const series: Record<string, Array<{ date: string; followers: number }>> = {};
    for (const [zid, points] of Object.entries(data.stats ?? {})) {
      series[`zernio_${zid}`] = points;
    }

    res.json({ accounts, series, days: safeDays });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

// ─── YouTube channel insights (per-channel daily metrics via Zernio) ──────────

interface InsightsResponse {
  metrics?: Record<string, { total?: number; values?: Array<{ date: string; value: number }> }>;
}

router.get("/zernio/youtube/insights", async (req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  const accountId = String(req.query["accountId"] ?? "").replace(/^zernio_/, "");
  if (!accountId) {
    res.status(400).json({ error: "accountId is required" });
    return;
  }

  const days = Number(req.query["days"] ?? 30);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 89) : 30;
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - safeDays + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;

  const params = new URLSearchParams({
    accountId,
    since: fmt(since),
    until: fmt(until),
    metricType: "time_series",
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
  });

  try {
    const resp = await fetch(`${ZERNIO_BASE}/analytics/youtube/channel-insights?${params}`, {
      headers: zernioHeaders(),
    });

    if (resp.status === 402 || resp.status === 403) {
      res.status(403).json({ error: "analytics_addon_required" });
      return;
    }
    if (resp.status === 412) {
      res.status(412).json({ error: "youtube_scope_missing" });
      return;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.status(resp.status).json({ error: `Zernio channel-insights ${resp.status}`, detail: body });
      return;
    }

    const data = (await resp.json()) as InsightsResponse;
    const metrics = data.metrics ?? {};

    // Build a date-keyed map so we can zip the metric series into daily rows.
    const byDate = new Map<string, { views: number; minutes: number; gained: number; lost: number }>();
    const ingest = (key: keyof { views: 0; minutes: 0; gained: 0; lost: 0 }, metricName: string) => {
      for (const pt of metrics[metricName]?.values ?? []) {
        const row = byDate.get(pt.date) ?? { views: 0, minutes: 0, gained: 0, lost: 0 };
        row[key] = pt.value;
        byDate.set(pt.date, row);
      }
    };
    ingest("views", "views");
    ingest("minutes", "estimatedMinutesWatched");
    ingest("gained", "subscribersGained");
    ingest("lost", "subscribersLost");

    const daily = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, r]) => ({
        date,
        views: r.views,
        watchTimeHours: Math.round((r.minutes / 60) * 10) / 10,
        subscribers: r.gained - r.lost,
      }));

    res.json({
      accountId: `zernio_${accountId}`,
      days: safeDays,
      totals: {
        views: metrics["views"]?.total ?? 0,
        watchTimeHours: Math.round(((metrics["estimatedMinutesWatched"]?.total ?? 0) / 60) * 10) / 10,
        subscribersGained: metrics["subscribersGained"]?.total ?? 0,
        subscribersLost: metrics["subscribersLost"]?.total ?? 0,
      },
      daily,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

// ─── Content performance (post-level analytics, cross-platform) ───────────────
// Zernio's richest dataset: every published post with real engagement metrics.

interface ZernioPostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
  lastUpdated?: string;
}

interface ZernioPost {
  _id: string;
  content?: string;
  publishedAt?: string;
  status?: string;
  platform?: string;
  mediaType?: string;
  thumbnailUrl?: string | null;
  platformPostUrl?: string;
  analytics?: ZernioPostAnalytics;
  platforms?: Array<{
    platform?: string;
    platformPostId?: string;
    accountId?: string;
    accountUsername?: string;
    platformPostUrl?: string;
    analytics?: ZernioPostAnalytics;
  }>;
}

router.get("/zernio/content", async (req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  const days = Number(req.query["days"] ?? 30);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 366) : 30;
  const limit = Math.min(Number(req.query["limit"] ?? 30) || 30, 100);
  const platform = req.query["platform"] ? String(req.query["platform"]) : undefined;

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - safeDays + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;

  const params = new URLSearchParams({
    fromDate: fmt(from),
    toDate: fmt(to),
    limit: String(limit),
    sortBy: "date",
    order: "desc",
  });
  if (platform) params.set("platform", platform);

  try {
    const resp = await fetch(`${ZERNIO_BASE}/analytics?${params}`, { headers: zernioHeaders() });
    if (resp.status === 402 || resp.status === 403) {
      res.status(403).json({ error: "analytics_addon_required" });
      return;
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.status(resp.status).json({ error: `Zernio analytics ${resp.status}`, detail: body });
      return;
    }

    const data = (await resp.json()) as {
      overview?: { totalPosts?: number; publishedPosts?: number };
      posts?: ZernioPost[];
    };

    const posts = (data.posts ?? []).map((p) => {
      const primary = p.platforms?.[0];
      const a = p.analytics ?? primary?.analytics ?? {};
      return {
        id: p._id,
        platform: p.platform ?? primary?.platform ?? "unknown",
        accountId: primary?.accountId ? `zernio_${primary.accountId}` : null,
        accountUsername: primary?.accountUsername ?? null,
        platformPostId: primary?.platformPostId ?? null,
        title: (p.content ?? "").split("\n")[0]!.slice(0, 120) || "(untitled)",
        publishedAt: p.publishedAt ?? null,
        mediaType: p.mediaType ?? null,
        thumbnailUrl: p.thumbnailUrl ?? null,
        url: p.platformPostUrl ?? primary?.platformPostUrl ?? null,
        views: a.views ?? 0,
        likes: a.likes ?? 0,
        comments: a.comments ?? 0,
        shares: a.shares ?? 0,
        saves: a.saves ?? 0,
        reach: a.reach ?? 0,
        impressions: a.impressions ?? 0,
        engagementRate: a.engagementRate ?? 0,
      };
    });

    res.json({
      overview: {
        totalPosts: data.overview?.totalPosts ?? posts.length,
        publishedPosts: data.overview?.publishedPosts ?? posts.length,
      },
      posts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

// ─── Comments for a post ──────────────────────────────────────────────────────
// Requires the platform-native post id + the Zernio account id (both surfaced
// by /zernio/content on each post).

interface ZernioComment {
  id: string;
  message?: string;
  createdTime?: string;
  from?: { name?: string; username?: string; picture?: string | null; isOwner?: boolean };
  likeCount?: number;
  replyCount?: number;
  platform?: string;
}

router.get("/zernio/comments", async (req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  const postId = String(req.query["postId"] ?? "");
  const accountId = String(req.query["accountId"] ?? "").replace(/^zernio_/, "");
  if (!postId || !accountId) {
    res.status(400).json({ error: "postId and accountId are required" });
    return;
  }
  const limit = Math.min(Number(req.query["limit"] ?? 25) || 25, 100);

  const params = new URLSearchParams({ accountId, limit: String(limit) });

  try {
    const resp = await fetch(
      `${ZERNIO_BASE}/inbox/comments/${encodeURIComponent(postId)}?${params}`,
      { headers: zernioHeaders() },
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      res.status(resp.status).json({ error: `Zernio comments ${resp.status}`, detail: body });
      return;
    }

    const data = (await resp.json()) as { status?: string; comments?: ZernioComment[] };
    const comments = (data.comments ?? []).map((c) => ({
      id: c.id,
      message: c.message ?? "",
      author: c.from?.name || c.from?.username || "Unknown",
      authorPicture: c.from?.picture ?? null,
      isOwner: !!c.from?.isOwner,
      likeCount: c.likeCount ?? 0,
      replyCount: c.replyCount ?? 0,
      createdAt: c.createdTime ?? null,
      platform: c.platform ?? null,
    }));

    res.json({ comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

// ─── Posts (kept for compatibility) ───────────────────────────────────────────

router.get("/zernio/posts", async (req, res) => {
  if (!hasKey()) {
    res.status(503).json({ error: "ZERNIO_API_KEY not configured" });
    return;
  }

  try {
    const limit = req.query["limit"] ?? "50";
    const resp = await fetch(`${ZERNIO_BASE}/posts?limit=${limit}`, { headers: zernioHeaders() });
    if (!resp.ok) {
      res.status(resp.status).json({ error: "Failed to fetch Zernio posts" });
      return;
    }
    const data = await resp.json() as { posts?: unknown[] };
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

export default router;
