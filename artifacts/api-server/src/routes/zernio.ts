import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ZERNIO_BASE = "https://zernio.com/api/v1";

function zernioHeaders() {
  const key = process.env["ZERNIO_API_KEY"];
  if (!key) throw new Error("ZERNIO_API_KEY not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
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
};

const AVATAR_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

function pickColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]!;
}

router.get("/zernio/accounts", async (_req, res) => {
  if (!process.env["ZERNIO_API_KEY"]) {
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

    const data = (await resp.json()) as { accounts?: ZernioAccount[] };
    const accounts: ZernioAccount[] = data.accounts ?? [];

    const mapped = accounts.map((a, idx) => ({
      id: `zernio_${a._id}`,
      name: a.metadata?.profileData?.displayName || a.username || a._id,
      handle: `@${a.username}`,
      platform: a.platform,
      url: a.profileUrl ?? "",
      avatarColor: PLATFORM_COLORS[a.platform] ?? pickColor(idx),
      profilePicture: a.profilePicture ?? null,
      subscribers: a.metadata?.profileData?.followersCount ?? 0,
      totalViews: 0,
      totalVideos: a.metadata?.profileData?.mediaCount ?? 0,
      totalWatchTimeHours: 0,
      avgViewsPerVideo: 0,
      subscriberGrowth30d: 0,
      viewsGrowth30d: 0,
      zernioId: a._id,
    }));

    res.json(mapped);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to reach Zernio API", detail: message });
  }
});

router.get("/zernio/posts", async (req, res) => {
  if (!process.env["ZERNIO_API_KEY"]) {
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

interface ZernioAccount {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  profilePicture?: string;
  metadata?: {
    profileData?: {
      displayName?: string;
      followersCount?: number;
      mediaCount?: number;
    };
  };
}

export default router;
