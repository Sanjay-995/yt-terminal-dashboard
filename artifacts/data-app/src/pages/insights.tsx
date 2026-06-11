import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Repeat,
  TrendingDown,
  Lightbulb,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent } from "@/lib/formatters";

interface DerivedInsight {
  kind: "timing" | "cadence" | "decay" | "volume" | "engagement";
  title: string;
  detail: string;
}
interface BestTimeSlot { day_of_week: number; hour: number; avg_engagement: number; post_count: number }
interface FrequencyRow { posts_per_week: number; avg_engagement_rate: number; weeks_count: number }
interface DecayBucket { bucket_order: number; bucket_label: string; avg_pct_of_final: number; post_count: number }
interface InsightsResponse {
  bestTimes: BestTimeSlot[];
  cadence: FrequencyRow[];
  decay: DecayBucket[];
  publishedPosts: number | null;
  derived: DerivedInsight[];
}

interface GrowthAccount {
  id: string;
  name: string;
  handle: string;
  platform: string;
  currentFollowers: number;
  growth: number | null;
  growthPercentage: number | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_ICON: Record<DerivedInsight["kind"], React.ReactNode> = {
  timing: <Clock className="w-4 h-4" />,
  cadence: <Repeat className="w-4 h-4" />,
  decay: <TrendingDown className="w-4 h-4" />,
  volume: <Flame className="w-4 h-4" />,
  engagement: <Lightbulb className="w-4 h-4" />,
};

const api = (path: string) =>
  fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`).then((r) =>
    r.ok ? r.json() : null,
  );

export function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [growth, setGrowth] = useState<GrowthAccount[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    Promise.all([
      api("/api/zernio/insights?platform=instagram"),
      api("/api/zernio/follower-stats?days=30"),
    ])
      .then(([ins, fs]) => {
        if (!ins) {
          setState("unavailable");
          return;
        }
        setData(ins as InsightsResponse);
        if (fs?.accounts) setGrowth(fs.accounts as GrowthAccount[]);
        setState("ready");
      })
      .catch(() => setState("unavailable"));
  }, []);

  // Build a 7×24 engagement matrix for the heatmap.
  const heat = useMemo(() => {
    const max = Math.max(1, ...(data?.bestTimes ?? []).map((s) => s.avg_engagement));
    const grid: Record<string, { v: number; posts: number }> = {};
    for (const s of data?.bestTimes ?? []) grid[`${s.day_of_week}-${s.hour}`] = { v: s.avg_engagement, posts: s.post_count };
    return { grid, max };
  }, [data]);

  const cadenceChart = useMemo(
    () =>
      [...(data?.cadence ?? [])]
        .filter((c) => c.weeks_count > 0)
        .sort((a, b) => a.posts_per_week - b.posts_per_week)
        .map((c) => ({ name: `${c.posts_per_week}/wk`, rate: Math.round(c.avg_engagement_rate * 10) / 10 })),
    [data],
  );

  const decayChart = useMemo(
    () =>
      [...(data?.decay ?? [])]
        .sort((a, b) => a.bucket_order - b.bucket_order)
        .map((b) => ({ name: b.bucket_label, pct: Math.round(b.avg_pct_of_final) })),
    [data],
  );

  const topGrowers = useMemo(
    () =>
      [...(growth ?? [])]
        .filter((g) => g.growth !== null)
        .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))
        .slice(0, 6),
    [growth],
  );

  if (state === "loading") {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold mb-2">Insights</h1>
        <Card className="bg-card mt-6">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Lightbulb className="w-6 h-6 mx-auto mb-3 opacity-50" />
            Insights are powered by Zernio analytics. Connect Zernio with the
            Analytics add-on in Settings to unlock posting-time, cadence, and
            content-decay analysis across your accounts.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2.5">
          Insights
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Analysis
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Patterns derived from {data?.publishedPosts ?? "your"} published posts across all connected accounts.
        </p>
      </div>

      {/* Derived takeaways */}
      {data && data.derived.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.derived.map((d, i) => (
            <Card key={i} className="bg-card border-l-2" style={{ borderLeftColor: "#8B5CF6" }}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-[#A78BFA] mb-2">
                  {KIND_ICON[d.kind]}
                  <span className="text-xs font-semibold uppercase tracking-wide">{d.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{d.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best-time heatmap */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Best Time to Post
            </CardTitle>
            <p className="text-xs text-muted-foreground">Avg engagement by day × hour (UTC). Darker = better.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="flex">
                <div className="w-10" />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="flex-1 text-center text-[8px] text-muted-foreground">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
              </div>
              {DAYS.map((day, d) => (
                <div key={day} className="flex items-center">
                  <div className="w-10 text-[10px] text-muted-foreground">{day}</div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const cell = heat.grid[`${d}-${h}`];
                    const intensity = cell ? cell.v / heat.max : 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 aspect-square m-[1px] rounded-sm"
                        style={{
                          backgroundColor: cell
                            ? `rgba(139,92,246,${0.15 + intensity * 0.85})`
                            : "rgba(255,255,255,0.03)",
                        }}
                        title={cell ? `${day} ${h}:00 — avg ${Math.round(cell.v)} eng, ${cell.posts} posts` : `${day} ${h}:00 — no posts`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Posting cadence */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted-foreground" /> Posting Cadence vs Engagement
            </CardTitle>
            <p className="text-xs text-muted-foreground">Engagement rate at each weekly posting volume.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cadenceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="%" />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Engagement"]}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {cadenceChart.map((entry, i) => {
                    const peak = Math.max(...cadenceChart.map((c) => c.rate));
                    return <Cell key={i} fill={entry.rate === peak ? "#22C55E" : "#8B5CF6"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content decay */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-muted-foreground" /> Engagement Maturity
            </CardTitle>
            <p className="text-xs text-muted-foreground">% of a post's final engagement reached over time since publishing.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={decayChart}>
                <defs>
                  <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "of final engagement"]}
                />
                <Area type="monotone" dataKey="pct" stroke="#06B6D4" strokeWidth={2} fill="url(#decayGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top growers */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-muted-foreground" /> Fastest-Growing Accounts
            </CardTitle>
            <p className="text-xs text-muted-foreground">Follower change over the last 30 days.</p>
          </CardHeader>
          <CardContent>
            {topGrowers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No growth data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {topGrowers.map((g) => {
                  const up = (g.growth ?? 0) >= 0;
                  return (
                    <div key={g.id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{g.name}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.platform}</div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-sm">{formatNumber(g.currentFollowers)}</div>
                        <div className={`text-[11px] flex items-center gap-0.5 justify-end ${up ? "text-emerald-500" : "text-red-500"}`}>
                          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {up ? "+" : ""}{g.growth}
                          {g.growthPercentage !== null && g.growthPercentage !== 0 ? ` · ${formatPercent(Math.abs(g.growthPercentage))}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
