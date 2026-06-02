/**
 * YouTube OAuth token store + API helpers.
 * Tokens are kept in module-level state (single-user dashboard).
 */

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

let _tokens: TokenData | null = null;

/**
 * IDs of YouTube channels that the connected OAuth account owns and therefore
 * has Analytics API access to. Populated lazily by getOwnedChannelIds() and
 * cleared on disconnect / token refresh failure.
 */
let _ownedChannelIds: Set<string> | null = null;
let _ownedChannelIdsFetchedAt = 0;
const OWNED_CACHE_TTL_MS = 5 * 60_000;

export function setTokens(data: TokenData): void {
  _tokens = data;
  _ownedChannelIds = null;
}

export function clearTokens(): void {
  _tokens = null;
  _ownedChannelIds = null;
  _ownedChannelIdsFetchedAt = 0;
}

export function isConnected(): boolean {
  return _tokens !== null;
}

export function getRefreshToken(): string | null {
  return _tokens?.refreshToken ?? null;
}

/**
 * Hydrate tokens from a known refresh token (e.g. loaded from env on cold start).
 * Sets accessToken empty + expiresAt=0 so the first API call refreshes immediately.
 */
export function hydrateFromRefreshToken(refreshToken: string): void {
  _tokens = { accessToken: "", refreshToken, expiresAt: 0 };
}

async function getAccessToken(): Promise<string> {
  if (!_tokens) throw new Error("Not connected to YouTube — please connect in Settings");

  // Refresh if expiring within 90 seconds
  if (Date.now() >= _tokens.expiresAt - 90_000) {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env["YOUTUBE_CLIENT_ID"],
        client_secret: process.env["YOUTUBE_CLIENT_SECRET"],
        refresh_token: _tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) {
      _tokens = null;
      throw new Error("YouTube token refresh failed — please reconnect in Settings");
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    _tokens.accessToken = data.access_token;
    _tokens.expiresAt = Date.now() + data.expires_in * 1000;
  }

  return _tokens.accessToken;
}

// ─── Types matching existing route response shapes ────────────────────────────

export interface YouTubeChannel {
  id: string;
  name: string;
  handle: string;
  thumbnail: string | null;
  subscribers: number;
  totalViews: number;
  totalVideos: number;
}

export interface DailyMetric {
  date: string;
  views: number;
  subscribers: number;
  watchTimeHours: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  estimatedRevenue: number;
}

export interface VideoRow {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  watchTimeHours: number;
  engagementRate: number;
  duration: string;
  thumbnailColor: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function getChannelByHandle(handle: string): Promise<YouTubeChannel | null> {
  const token = await getAccessToken();
  const cleanHandle = handle.replace(/^@/, "");

  const resp = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=@${cleanHandle}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) throw new Error(`YouTube forHandle error: ${resp.status} ${resp.statusText}`);

  const data = await resp.json() as {
    items?: Array<{
      id: string;
      snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
      statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    }>;
  };

  const item = data.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    name: item.snippet.title,
    handle: `@${cleanHandle}`,
    thumbnail: item.snippet.thumbnails?.default?.url ?? null,
    subscribers: parseInt(item.statistics.subscriberCount ?? "0", 10),
    totalViews: parseInt(item.statistics.viewCount ?? "0", 10),
    totalVideos: parseInt(item.statistics.videoCount ?? "0", 10),
  };
}

/**
 * Return the set of YouTube channel IDs we have Analytics API access to via
 * the current OAuth grant. These are the channels owned by the OAuth account.
 *
 * Cached for OWNED_CACHE_TTL_MS to keep request latency down. Returns an
 * empty set when not connected or on lookup failure.
 */
export async function getOwnedChannelIds(): Promise<Set<string>> {
  if (!_tokens) return new Set();
  const now = Date.now();
  if (_ownedChannelIds && now - _ownedChannelIdsFetchedAt < OWNED_CACHE_TTL_MS) {
    return _ownedChannelIds;
  }
  try {
    const channels = await getMyChannels();
    _ownedChannelIds = new Set(channels.map((c) => c.id));
    _ownedChannelIdsFetchedAt = now;
    return _ownedChannelIds;
  } catch {
    // Don't poison the cache on a transient error; return empty so callers
    // honestly degrade rather than fabricating Analytics access.
    return _ownedChannelIds ?? new Set();
  }
}

export async function getMyChannels(): Promise<YouTubeChannel[]> {
  const token = await getAccessToken();

  const resp = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) throw new Error(`YouTube channels API error: ${resp.status} ${resp.statusText}`);

  const data = await resp.json() as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        customUrl?: string;
        thumbnails?: { default?: { url: string } };
      };
      statistics: {
        subscriberCount?: string;
        viewCount?: string;
        videoCount?: string;
      };
    }>;
  };

  return (data.items ?? []).map((item) => ({
    id: item.id,
    name: item.snippet.title,
    handle: item.snippet.customUrl
      ? `@${item.snippet.customUrl.replace(/^@/, "")}`
      : `@${item.snippet.title.toLowerCase().replace(/\s+/g, "")}`,
    thumbnail: item.snippet.thumbnails?.default?.url ?? null,
    subscribers: parseInt(item.statistics.subscriberCount ?? "0", 10),
    totalViews: parseInt(item.statistics.viewCount ?? "0", 10),
    totalVideos: parseInt(item.statistics.videoCount ?? "0", 10),
  }));
}

function isoDurationToDisplay(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10) + h * 60;
  const s = parseInt(match[3] ?? "0", 10);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Small TTL cache for Analytics API responses. /overview, /overview/trends,
// and per-channel /metrics can each ask for similar (channel, days) tuples
// in quick succession — without this each one would round-trip to Google.
const METRICS_TTL_MS = 5 * 60_000;
const _metricsCache = new Map<string, { value: DailyMetric[]; at: number }>();

export async function getRealMetrics(ytChannelId: string, days: number): Promise<DailyMetric[]> {
  const cacheKey = `${ytChannelId}:${days}`;
  const cached = _metricsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < METRICS_TTL_MS) {
    return cached.value;
  }
  const token = await getAccessToken();

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const startDate = fmt(start);
  const endDate = fmt(end);

  // CORE metrics — available with the yt-analytics.readonly scope. We MUST NOT
  // mix revenue metrics into this query: estimatedRevenue requires the separate
  // yt-analytics-monetary.readonly scope, and YouTube fails the ENTIRE report
  // with 401 "Insufficient permission" if revenue is requested without it.
  const coreParams = new URLSearchParams({
    ids: `channel==${ytChannelId}`,
    startDate,
    endDate,
    dimensions: "day",
    metrics: "views,averageViewDuration,subscribersGained,likes,comments,shares",
    sort: "day",
  });

  const resp = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${coreParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`YouTube Analytics error ${resp.status}: ${body}`);
  }

  const data = await resp.json() as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<Array<string | number>>;
  };

  const headers = (data.columnHeaders ?? []).map((h) => h.name);
  const rows = data.rows ?? [];

  // REVENUE — fetched in a SEPARATE, failure-tolerant query. Monetized channels
  // with the monetary scope get real numbers keyed by day; everyone else gets
  // an empty map and estimatedRevenue stays 0 (we never fabricate it).
  const revenueByDay = new Map<string, number>();
  try {
    const revParams = new URLSearchParams({
      ids: `channel==${ytChannelId}`,
      startDate,
      endDate,
      dimensions: "day",
      metrics: "estimatedRevenue",
      sort: "day",
    });
    const revResp = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?${revParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (revResp.ok) {
      const revData = await revResp.json() as {
        columnHeaders?: Array<{ name: string }>;
        rows?: Array<Array<string | number>>;
      };
      const revHeaders = (revData.columnHeaders ?? []).map((h) => h.name);
      const dIdx = revHeaders.indexOf("day");
      const rIdx = revHeaders.indexOf("estimatedRevenue");
      for (const row of revData.rows ?? []) {
        const day = String(dIdx >= 0 ? row[dIdx] : row[0]);
        revenueByDay.set(day, Number(row[rIdx] ?? 0));
      }
    }
    // Non-OK (e.g. 401 without monetary scope) is expected — revenue stays 0.
  } catch {
    // Network/parse error — degrade silently to 0 revenue.
  }

  const result: DailyMetric[] = rows.map((row) => {
    const col = (name: string): number => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? Number(row[idx]) : 0;
    };

    const views = col("views");
    const likes = col("likes");
    const comments = col("comments");
    const shares = col("shares");
    const avgDurSecs = col("averageViewDuration");
    const watchTimeHours = Math.round((views * avgDurSecs) / 3600 * 10) / 10;
    const engagementRate =
      views > 0 ? Math.round(((likes + comments + shares) / views) * 1000) / 10 : 0;

    const dayIdx = headers.indexOf("day");
    const date = String(dayIdx >= 0 ? row[dayIdx] : row[0]);

    return {
      date,
      views,
      subscribers: col("subscribersGained"),
      watchTimeHours,
      likes,
      comments,
      shares,
      engagementRate,
      estimatedRevenue: Math.round((revenueByDay.get(date) ?? 0) * 100) / 100,
    };
  });

  _metricsCache.set(cacheKey, { value: result, at: Date.now() });
  return result;
}

/**
 * Fetch recent video aggregate stats for ANY public channel via the Data API.
 *
 * Works for every imported channel (no per-brand OAuth needed) because the
 * /videos endpoint returns publicly visible counters under our app's OAuth
 * token. Returns null when the channel has no uploads or the call errors so
 * callers can render "—" rather than fabricate.
 *
 * `engagementRate` is (likes + comments) / views averaged across `sampleSize`
 * most recent uploads, expressed as a percentage with one decimal.
 */
export interface RecentVideoStats {
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  /** Percentage with one decimal, e.g. 4.2 for 4.2%. Null when no views. */
  engagementRate: number | null;
}

export async function getRecentVideoStats(
  ytChannelId: string,
  sampleSize = 10,
): Promise<RecentVideoStats | null> {
  const token = await getAccessToken();

  // Step 1: Get uploads playlist ID
  const chResp = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ytChannelId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!chResp.ok) return null;

  const chData = await chResp.json() as {
    items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
  };
  const uploadsId = chData.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploadsId) return null;

  // Step 2: Recent video IDs
  const plResp = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=${Math.min(sampleSize, 50)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!plResp.ok) return null;

  const plData = await plResp.json() as {
    items?: Array<{ contentDetails: { videoId: string } }>;
  };
  const videoIds = (plData.items ?? []).map((i) => i.contentDetails.videoId).filter(Boolean);
  if (videoIds.length === 0) return null;

  // Step 3: Stats per video
  const vResp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!vResp.ok) return null;

  const vData = await vResp.json() as {
    items?: Array<{
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
    }>;
  };

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  for (const v of vData.items ?? []) {
    totalViews += parseInt(v.statistics.viewCount ?? "0", 10);
    totalLikes += parseInt(v.statistics.likeCount ?? "0", 10);
    totalComments += parseInt(v.statistics.commentCount ?? "0", 10);
  }

  return {
    videoCount: vData.items?.length ?? 0,
    totalViews,
    totalLikes,
    totalComments,
    engagementRate:
      totalViews > 0
        ? Math.round(((totalLikes + totalComments) / totalViews) * 1000) / 10
        : null,
  };
}

export async function getRealVideos(
  ytChannelId: string,
  limit: number,
  avatarColor: string
): Promise<VideoRow[]> {
  const token = await getAccessToken();

  // Step 1: Get uploads playlist ID
  const chResp = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ytChannelId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!chResp.ok) throw new Error(`YouTube channel lookup error: ${chResp.status}`);

  const chData = await chResp.json() as {
    items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
  };

  const uploadsId = chData.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploadsId) return [];

  // Step 2: Get recent video IDs from uploads playlist
  const plResp = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${Math.min(limit, 50)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!plResp.ok) throw new Error(`YouTube playlist error: ${plResp.status}`);

  const plData = await plResp.json() as {
    items?: Array<{ snippet: { resourceId: { videoId: string } } }>;
  };

  const videoIds = (plData.items ?? []).map((i) => i.snippet.resourceId.videoId).join(",");
  if (!videoIds) return [];

  // Step 3: Fetch video stats and metadata
  const vResp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!vResp.ok) throw new Error(`YouTube videos error: ${vResp.status}`);

  const vData = await vResp.json() as {
    items?: Array<{
      id: string;
      snippet: { title: string; publishedAt: string };
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails: { duration: string };
    }>;
  };

  return (vData.items ?? []).map((v) => {
    const views = parseInt(v.statistics.viewCount ?? "0", 10);
    const likes = parseInt(v.statistics.likeCount ?? "0", 10);
    const comments = parseInt(v.statistics.commentCount ?? "0", 10);
    const engagementRate =
      views > 0 ? Math.round(((likes + comments) / views) * 1000) / 10 : 0;
    const watchTimeHours = Math.round(views * 0.045 * 8 / 60 * 10) / 10;

    return {
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt.split("T")[0]!,
      views,
      likes,
      comments,
      watchTimeHours,
      engagementRate,
      duration: isoDurationToDisplay(v.contentDetails.duration),
      thumbnailColor: avatarColor,
    };
  });
}
