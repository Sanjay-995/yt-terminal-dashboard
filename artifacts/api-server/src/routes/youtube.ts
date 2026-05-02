import { Router, type IRouter } from "express";
import {
  GetChannelsResponse,
  GetChannelMetricsParams,
  GetChannelVideosParams,
  GetOverviewTrendsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Sample Data ─────────────────────────────────────────────────────────────

const CHANNELS = [
  {
    id: "ch_mkbhd",
    name: "MKBHD",
    handle: "@mkbhd",
    avatarColor: "#FF0000",
    subscribers: 18_400_000,
    totalViews: 4_200_000_000,
    totalVideos: 1_720,
    totalWatchTimeHours: 310_000_000,
    avgViewsPerVideo: 2_441_860,
    subscriberGrowth30d: 85_000,
    viewsGrowth30d: 4.2,
    engagementRate: 3.8,
  },
  {
    id: "ch_linus",
    name: "Linus Tech Tips",
    handle: "@linustechtips",
    avatarColor: "#FFC107",
    subscribers: 15_200_000,
    totalViews: 5_800_000_000,
    totalVideos: 6_200,
    totalWatchTimeHours: 420_000_000,
    avgViewsPerVideo: 935_484,
    subscriberGrowth30d: 42_000,
    viewsGrowth30d: 2.9,
    engagementRate: 2.9,
  },
  {
    id: "ch_verge",
    name: "The Verge",
    handle: "@theverge",
    avatarColor: "#E91E63",
    subscribers: 3_600_000,
    totalViews: 820_000_000,
    totalVideos: 4_800,
    totalWatchTimeHours: 52_000_000,
    avgViewsPerVideo: 170_833,
    subscriberGrowth30d: 9_200,
    viewsGrowth30d: 1.8,
    engagementRate: 2.1,
  },
  {
    id: "ch_ifixit",
    name: "iFixit",
    handle: "@ifixit",
    avatarColor: "#4CAF50",
    subscribers: 4_100_000,
    totalViews: 1_100_000_000,
    totalVideos: 1_200,
    totalWatchTimeHours: 78_000_000,
    avgViewsPerVideo: 916_667,
    subscriberGrowth30d: 15_000,
    viewsGrowth30d: 3.1,
    engagementRate: 4.2,
  },
  {
    id: "ch_gamers",
    name: "GamersNexus",
    handle: "@gamersnexus",
    avatarColor: "#9C27B0",
    subscribers: 3_900_000,
    totalViews: 980_000_000,
    totalVideos: 2_400,
    totalWatchTimeHours: 88_000_000,
    avgViewsPerVideo: 408_333,
    subscriberGrowth30d: 22_000,
    viewsGrowth30d: 5.4,
    engagementRate: 5.1,
  },
];

// Generate 30 days of sample daily metrics for a channel
function generateDailyMetrics(channelId: string, days: number) {
  const seeds: Record<string, { baseViews: number; baseSubs: number; baseRevenue: number }> = {
    ch_mkbhd:   { baseViews: 900_000,  baseSubs: 2_800,  baseRevenue: 3_600 },
    ch_linus:   { baseViews: 600_000,  baseSubs: 1_400,  baseRevenue: 2_400 },
    ch_verge:   { baseViews: 85_000,   baseSubs: 310,    baseRevenue: 340 },
    ch_ifixit:  { baseViews: 120_000,  baseSubs: 500,    baseRevenue: 480 },
    ch_gamers:  { baseViews: 180_000,  baseSubs: 730,    baseRevenue: 720 },
  };

  const seed = seeds[channelId] ?? { baseViews: 100_000, baseSubs: 500, baseRevenue: 400 };
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const weekendBoost = isWeekend ? 1.3 : 1.0;
    const trend = 1 + (days - i) * 0.003; // slight upward trend
    const noise = () => 0.7 + Math.random() * 0.6;

    const views = Math.round(seed.baseViews * weekendBoost * trend * noise());
    const likes = Math.round(views * 0.035 * noise());
    const comments = Math.round(views * 0.005 * noise());
    const shares = Math.round(views * 0.008 * noise());
    const watchTimeHours = Math.round(views * 0.04 * noise() * 10) / 10;
    const subscribers = Math.round(seed.baseSubs * weekendBoost * trend * noise());
    const engagementRate = Math.round(((likes + comments + shares) / views) * 1000) / 10;
    const estimatedRevenue = Math.round(seed.baseRevenue * trend * noise() * 100) / 100;

    result.push({
      date: date.toISOString().split("T")[0],
      views,
      subscribers,
      watchTimeHours,
      likes,
      comments,
      shares,
      engagementRate,
      estimatedRevenue,
    });
  }

  return result;
}

// Generate top videos for a channel
function generateVideos(channelId: string, limit: number) {
  const videoTemplates: Record<string, { titles: string[]; color: string }> = {
    ch_mkbhd: {
      color: "#FF0000",
      titles: [
        "Every iPhone 17 Question Answered",
        "The Best Android Phone of 2025",
        "Galaxy S25 Ultra Full Review",
        "Tesla Cybertruck — 6 Months Later",
        "The Most Expensive Tech I've Ever Reviewed",
        "Pixel 9 Pro vs iPhone 16 Pro",
        "I Bought Every Apple Vision Pro Accessory",
        "The Truth About Folding Phones in 2025",
        "MacBook Pro M4 Max — Is It Worth $4,000?",
        "OnePlus 13 Review: Back in the Game",
        "The Best Budget Phone Under $300",
        "Windows on ARM is Finally Good",
        "Xiaomi 15 Ultra Blind Test",
        "AI Cameras Are Getting Scary Good",
        "Nothing Phone 3 — First Look",
        "Why I Switched Back to Android",
        "iPad Pro M4 vs MacBook Air — Which to Buy?",
        "Sony Xperia vs iPhone Camera Comparison",
        "Smartwatch Mega Showdown 2025",
        "The Drone That Changed Everything",
      ],
    },
    ch_linus: {
      color: "#FFC107",
      titles: [
        "We Built the World's Quietest PC",
        "RTX 5090 Benchmark Blowout",
        "The $100,000 Server Room Makeover",
        "AMD vs Intel 2025: No More Excuses",
        "DDR6 RAM: Does It Actually Matter?",
        "Buying a Used GPU in 2025 — Worth It?",
        "The PC We Should Have Built Years Ago",
        "Liquid Cooled PS5 Experiment",
        "Radeon RX 9700 XT vs RTX 4080",
        "Building the Perfect Video Editing PC",
        "Tech I Regret Buying",
        "Our $500 Gaming PC Challenge",
        "Water Damaged MacBook Restoration",
        "Inside Our 200Gbps Network Setup",
        "The Most Efficient Gaming PC Build",
        "Intel Fails Again — But Maybe Not?",
        "Custom Loop Cooling on a Laptop",
        "Thunderbolt 5 — Everything You Need to Know",
        "Is Wi-Fi 7 Worth Upgrading For?",
        "1000W Power Supply vs 400W — Real Difference?",
      ],
    },
    ch_verge: {
      color: "#E91E63",
      titles: [
        "The Verge Reviews: Apple's Biggest Bet Yet",
        "Tech Companies Are Lying to You",
        "Is This the Last Smartphone Era?",
        "The Problem With AI in Everything",
        "Hands On: Meta's AR Glasses",
        "Why Your Smart Home Is a Privacy Risk",
        "The Laptop That Does Everything Wrong",
        "OpenAI's New Model Explained",
        "Streaming Wars: Who's Actually Winning?",
        "The EV That Doesn't Compromise",
        "Google's Antitrust Problem Gets Worse",
        "Why Apple Keeps Winning With Chips",
        "The Best Keyboard We've Ever Tested",
        "TikTok, the Algorithm, and You",
        "This Camera Changed How We Make Videos",
        "Every Major AI Announcement This Week",
        "The Future of Search Is Broken",
        "Samsung's Risky Galaxy Bet",
        "5G: Still Waiting for the Revolution",
        "How Big Tech Got So Powerful",
      ],
    },
    ch_ifixit: {
      color: "#4CAF50",
      titles: [
        "iPhone 17 Teardown — First Look Inside",
        "Galaxy S25 Ultra: Repairability Score",
        "We Fixed a $4,000 MacBook for $80",
        "The Most Repairable Laptop of 2025",
        "Right to Repair: The Fight Isn't Over",
        "Surface Pro Teardown — Nightmare Inside",
        "How to Replace Your EV Battery",
        "Pixel 9a Teardown: Surprisingly Good",
        "Nintendo Switch 2 — Full Teardown",
        "Vision Pro Lens Replacement Guide",
        "Fixing the MacBook That Apple Abandoned",
        "The Repairability Report Card 2025",
        "Sony PlayStation 5 Pro Disassembly",
        "AirPods Max Battery Replacement",
        "This TV Was Designed to Never Be Fixed",
        "The Cheapest Way to Upgrade Your Laptop",
        "We Cracked Open a Folding Phone",
        "M4 iMac Inside: What Apple Changed",
        "Why Modular Phones Failed",
        "Fixing 100 Dead Laptops from eBay",
      ],
    },
    ch_gamers: {
      color: "#9C27B0",
      titles: [
        "RTX 5090 vs RX 9900 XTX — The Truth",
        "Intel Arc B770 Review: Shocking Results",
        "We Tested 50 Thermal Pastes",
        "$2,000 vs $500 Gaming PC — Frame Time Analysis",
        "CPU Cooler Tier List 2025",
        "AMD vs NVIDIA: Drivers Actually Matter",
        "Are Mini-ITX Builds Worth the Compromise?",
        "The Most Thermally Efficient GPU Tier List",
        "DDR6 Latency: Deep Dive Analysis",
        "OLED vs QLED — The Real Difference",
        "Power Consumption Reality Check: 2025 GPUs",
        "240Hz vs 360Hz — Can You See the Difference?",
        "Budget CPU Mega Test: 16 CPUs Ranked",
        "The Best $200 GPU You Can Buy Right Now",
        "PCIe 5 NVMe vs PCIe 4 — Real Workloads",
        "Fan Curve Optimization — How to Do It Right",
        "Case Airflow Comparison: 20 Cases Tested",
        "Overclocking Is Dead — Or Is It?",
        "AM5 vs LGA1851: Which Platform Ages Better?",
        "The 1080p Build Everyone Recommends Is Wrong",
      ],
    },
  };

  const template = videoTemplates[channelId] ?? videoTemplates["ch_mkbhd"];
  const now = new Date();

  return template.titles.slice(0, limit).map((title, i) => {
    const daysAgo = Math.floor(Math.random() * 90) + i * 2;
    const published = new Date(now);
    published.setDate(published.getDate() - daysAgo);
    const views = Math.round((800_000 - i * 35_000) * (0.7 + Math.random() * 0.6));
    const likes = Math.round(views * 0.038 * (0.8 + Math.random() * 0.4));
    const comments = Math.round(views * 0.006 * (0.8 + Math.random() * 0.4));
    const watchTimeHours = Math.round(views * 0.045 * (0.8 + Math.random() * 0.4) * 10) / 10;
    const engagementRate = Math.round(((likes + comments) / views) * 1000) / 10;
    const durationMins = 8 + Math.floor(Math.random() * 22);
    const durationSecs = Math.floor(Math.random() * 60);
    return {
      id: `${channelId}_v${i}`,
      title,
      publishedAt: published.toISOString().split("T")[0],
      views,
      likes,
      comments,
      watchTimeHours,
      engagementRate,
      duration: `${durationMins}:${String(durationSecs).padStart(2, "0")}`,
      thumbnailColor: template.color,
    };
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/channels", async (_req, res): Promise<void> => {
  const parsed = GetChannelsResponse.safeParse(CHANNELS);
  if (!parsed.success) {
    res.status(500).json({ error: "Data validation error" });
    return;
  }
  res.json(parsed.data);
});

router.get("/channels/:channelId/metrics", async (req, res): Promise<void> => {
  const params = GetChannelMetricsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const channel = CHANNELS.find((c) => c.id === params.data.channelId);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const days = Number(req.query["days"] ?? 30);
  const metrics = generateDailyMetrics(params.data.channelId, isNaN(days) ? 30 : days);
  res.json(metrics);
});

router.get("/channels/:channelId/videos", async (req, res): Promise<void> => {
  const params = GetChannelVideosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const channel = CHANNELS.find((c) => c.id === params.data.channelId);
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const limit = Number(req.query["limit"] ?? 20);
  const videos = generateVideos(params.data.channelId, isNaN(limit) ? 20 : limit);
  res.json(videos);
});

router.get("/overview", async (_req, res): Promise<void> => {
  const totals = CHANNELS.reduce(
    (acc, ch) => ({
      totalSubscribers: acc.totalSubscribers + ch.subscribers,
      totalViews30d: acc.totalViews30d + Math.round(ch.totalViews * 0.007),
      totalWatchTimeHours30d: acc.totalWatchTimeHours30d + Math.round(ch.totalWatchTimeHours * 0.006),
      totalEstimatedRevenue30d: acc.totalEstimatedRevenue30d + Math.round(ch.totalViews * 0.000002 * 100) / 100,
      subscriberGrowth30d: acc.subscriberGrowth30d + ch.subscriberGrowth30d,
    }),
    { totalSubscribers: 0, totalViews30d: 0, totalWatchTimeHours30d: 0, totalEstimatedRevenue30d: 0, subscriberGrowth30d: 0 }
  );

  const avgEngagementRate =
    Math.round(
      (CHANNELS.reduce((sum, ch) => sum + ch.engagementRate, 0) / CHANNELS.length) * 10
    ) / 10;

  const topByViews = CHANNELS.reduce((a, b) =>
    a.totalViews > b.totalViews ? a : b
  );
  const topByGrowth = CHANNELS.reduce((a, b) =>
    a.subscriberGrowth30d > b.subscriberGrowth30d ? a : b
  );

  res.json({
    ...totals,
    avgEngagementRate,
    viewsGrowth30d: 3.4,
    revenueGrowth30d: 7.2,
    topChannelByViews: topByViews.name,
    topChannelByGrowth: topByGrowth.name,
  });
});

router.get("/overview/trends", async (req, res): Promise<void> => {
  const queryParams = GetOverviewTrendsQueryParams.safeParse(req.query);
  const days = queryParams.success ? queryParams.data.days : 30;

  const now = new Date();
  const trends = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const weekendBoost = isWeekend ? 1.25 : 1.0;
    const trend = 1 + (days - i) * 0.003;
    const noise = () => 0.75 + Math.random() * 0.5;

    const baseViews = 1_885_000;
    const baseSubs = 5_740;
    const baseRevenue = 7_540;
    const baseWatchHours = 75_000;

    trends.push({
      date: date.toISOString().split("T")[0],
      totalViews: Math.round(baseViews * weekendBoost * trend * noise()),
      totalSubscribers: Math.round(baseSubs * weekendBoost * trend * noise()),
      totalWatchTimeHours: Math.round(baseWatchHours * weekendBoost * trend * noise() * 10) / 10,
      totalRevenue: Math.round(baseRevenue * trend * noise() * 100) / 100,
    });
  }

  res.json(trends);
});

export default router;
