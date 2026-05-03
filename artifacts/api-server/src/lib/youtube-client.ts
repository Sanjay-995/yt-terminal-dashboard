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

export function setTokens(data: TokenData): void {
  _tokens = data;
}

export function clearTokens(): void {
  _tokens = null;
}

export function isConnected(): boolean {
  return _tokens !== null;
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

export async function getRealMetrics(ytChannelId: string, days: number): Promise<DailyMetric[]> {
  const token = await getAccessToken();

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;

  const params = new URLSearchParams({
    ids: `channel==${ytChannelId}`,
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: "day",
    metrics: "views,estimatedRevenue,averageViewDuration,subscribersGained,likes,comments,shares",
    sort: "day",
  });

  const resp = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
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

  return rows.map((row) => {
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

    return {
      date: String(dayIdx >= 0 ? row[dayIdx] : row[0]),
      views,
      subscribers: col("subscribersGained"),
      watchTimeHours,
      likes,
      comments,
      shares,
      engagementRate,
      estimatedRevenue: Math.round(col("estimatedRevenue") * 100) / 100,
    };
  });
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
