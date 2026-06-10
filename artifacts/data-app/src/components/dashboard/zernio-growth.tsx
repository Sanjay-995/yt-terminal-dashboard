import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, deriveAccent } from "@/lib/formatters";

// ─── Types matching GET /api/zernio/follower-stats ────────────────────────────

interface ZernioFollowerAccount {
  id: string;
  zernioId: string;
  name: string;
  handle: string;
  platform: string;
  currentFollowers: number;
  growth: number | null;
  growthPercentage: number | null;
  dataPoints: number;
}

interface FollowerStatsResponse {
  accounts: ZernioFollowerAccount[];
  series: Record<string, Array<{ date: string; followers: number }>>;
  days: number;
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

/**
 * Cross-channel follower growth, powered by Zernio's follower-stats endpoint.
 * This is data the direct YouTube-OAuth path can't provide: daily follower
 * history + growth for EVERY connected account across platforms.
 *
 * Renders nothing (returns null) when Zernio isn't configured / reachable, so
 * the panel simply doesn't appear rather than showing a broken state.
 */
export function ZernioGrowthPanel({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<FollowerStatsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden" | "addon">("loading");

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/zernio/follower-stats?days=${days}`)
      .then(async (r) => {
        if (r.status === 403) {
          setState("addon");
          return null;
        }
        if (!r.ok) {
          setState("hidden");
          return null;
        }
        return r.json() as Promise<FollowerStatsResponse>;
      })
      .then((d) => {
        if (!d) return;
        if (!d.accounts || d.accounts.length === 0) {
          setState("hidden");
          return;
        }
        setData(d);
        setState("ready");
      })
      .catch(() => setState("hidden"));
  }, [days]);

  // Aggregate daily follower total across all accounts for the headline sparkline.
  const aggregate = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, number>();
    for (const points of Object.values(data.series)) {
      for (const p of points) {
        byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.followers);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, followers]) => ({ date, followers }));
  }, [data]);

  // Rank by absolute growth, biggest movers first.
  const ranked = useMemo(() => {
    if (!data) return [];
    return [...data.accounts].sort(
      (a, b) => Math.abs(b.growth ?? 0) - Math.abs(a.growth ?? 0),
    );
  }, [data]);

  if (state === "hidden") return null;

  if (state === "addon") {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follower Growth · Zernio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cross-channel follower history needs the Zernio Analytics add-on.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state === "loading") {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follower Growth · Zernio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalFollowers = ranked.reduce((s, a) => s + (a.currentFollowers ?? 0), 0);
  const totalGrowth = ranked.reduce((s, a) => s + (a.growth ?? 0), 0);

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF0000]" />
              Follower Growth · Zernio
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              All {ranked.length} connected accounts · last {data?.days ?? days} days
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums">
              {formatNumber(totalFollowers)}
            </div>
            <div
              className={`text-xs font-medium ${
                totalGrowth >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {totalGrowth >= 0 ? "↑" : "↓"} {formatNumber(Math.abs(totalGrowth))} this period
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {aggregate.length > 1 && (
          <div className="h-16 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregate} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="zernioFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF0000" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#FF0000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,20,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#aaa" }}
                  formatter={(v: number) => [formatNumber(v), "Followers"]}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="#FF0000"
                  strokeWidth={1.5}
                  fill="url(#zernioFollowers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="divide-y divide-border">
          {ranked.map((a) => {
            const accent = deriveAccent(a.handle, a.platform === "youtube" ? "#FF0000" : "#E1306C");
            const pct = a.growthPercentage;
            const grw = a.growth ?? 0;
            return (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {PLATFORM_LABEL[a.platform] ?? a.platform}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm tabular-nums">{formatNumber(a.currentFollowers)}</div>
                  <div
                    className={`text-[11px] tabular-nums ${
                      grw > 0 ? "text-emerald-500" : grw < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}
                  >
                    {grw > 0 ? "+" : ""}
                    {formatNumber(grw)}
                    {pct != null && pct !== 0 ? ` · ${formatPercent(pct)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
