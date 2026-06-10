import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOverview,
  useGetOverviewTrends,
  useGetChannels,
  getGetOverviewQueryKey,
  getGetOverviewTrendsQueryKey,
  getGetChannelsQueryKey,
} from "@workspace/api-client-react";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { ZernioGrowthPanel } from "@/components/dashboard/zernio-growth";
import {
  DarkModeToggle,
  ExportPdfButton,
  SplitRefreshButton,
  LastRefreshed,
} from "@/components/dashboard/controls";
import { CustomTooltip, CustomLegend } from "@/components/dashboard/charts";
import {
  CHART_COLORS,
  formatCompact,
  formatCurrency,
  formatPercent,
  formatDate,
  isMissing,
  deriveAccent,
} from "@/lib/formatters";
import { CSVLink } from "react-csv";
import { Download, AlertCircle, Info } from "lucide-react";

function getDarkPref(): boolean {
  try {
    const stored = localStorage.getItem("yt_dark");
    if (stored !== null) return stored === "1";
  } catch {}
  return document.documentElement.classList.contains("dark");
}

export function OverviewPage() {
  const [isDark, setIsDark] = useState(getDarkPref);
  const queryClient = useQueryClient();

  const overviewQuery = useGetOverview();
  const trendsQuery = useGetOverviewTrends({ days: 30 });
  const channelsQuery = useGetChannels();

  const isInitialLoading =
    overviewQuery.isLoading ||
    trendsQuery.isLoading ||
    channelsQuery.isLoading;

  const isBusy =
    overviewQuery.isFetching ||
    trendsQuery.isFetching ||
    channelsQuery.isFetching;

  const hasError =
    overviewQuery.isError || trendsQuery.isError || channelsQuery.isError;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getGetOverviewTrendsQueryKey({ days: 30 }),
    });
    queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
  };

  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#e5e5e5";
  const tickColor = isDark ? "#88888b" : "#71717a";

  const channels = channelsQuery.data ?? [];
  const channelCount = channels.length;

  // Channels for which the OAuth account owns the underlying YouTube channel
  // and we therefore have Analytics API access (revenue, watch time, daily
  // breakdowns). Backend computes this from getOwnedChannelIds().
  const connectedChannels = useMemo(
    () => channels.filter((c) => c.hasAnalyticsAccess),
    [channels],
  );

  // Decide what to render in the trends chart. Only one channel has real
  // time-series → the "Cross-Channel" framing is misleading.
  const onlyConnected = connectedChannels.length === 1
    ? connectedChannels[0]
    : null;

  const trendData = trendsQuery.data ?? [];
  const trendsHaveSignal = trendData.some(
    (d) => (d.totalViews ?? 0) > 0 || (d.totalSubscribers ?? 0) > 0,
  );

  const overview = overviewQuery.data;
  // Provenance flags. If only one channel is connected, aggregates that
  // require Analytics (revenue, engagement, watch hours, growth) effectively
  // describe that channel only — flag them as "live" but with a hint.
  const aggregateHint =
    onlyConnected && !isInitialLoading
      ? `From ${onlyConnected.name} (only connected channel)`
      : connectedChannels.length > 1
      ? `Across ${connectedChannels.length} connected channels`
      : undefined;

  const subsAreReal = !isMissing(overview?.totalSubscribers);

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-[26px] font-bold tracking-tight">
                Mission Control
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Overview
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-[13px]">
              {isInitialLoading ? (
                "Loading channels…"
              ) : channelCount === 0 ? (
                "No channels tracked yet."
              ) : (
                <>
                  Tracking{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {channelCount}
                  </span>{" "}
                  channel{channelCount === 1 ? "" : "s"} ·{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {connectedChannels.length}
                  </span>{" "}
                  with live Analytics
                </>
              )}
            </p>
            <LastRefreshed updatedAt={overviewQuery.dataUpdatedAt} />
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <SplitRefreshButton
              isDark={isDark}
              loading={isInitialLoading || isBusy}
              onRefresh={handleRefresh}
            />
            <ExportPdfButton isDark={isDark} loading={isInitialLoading} />
            <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
          </div>
        </div>

        {/* Provenance legend — quietly placed under the header */}
        {!isInitialLoading && channelCount > 0 && (
          <ProvenanceLegend
            connectedCount={connectedChannels.length}
            totalCount={channelCount}
          />
        )}

        {/* Error banner */}
        {hasError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Some data failed to load. Check your API connection and try
            refreshing.
          </div>
        )}

        {/* KPIs — total subs leads (always real), Analytics-derived metrics
            follow with explicit provenance dots. */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard
            title="Total Subs"
            value={
              overview ? formatCompact(overview.totalSubscribers) : "--"
            }
            change={overview?.subscriberGrowth30d}
            tone="primary"
            provenance={subsAreReal ? "public" : "unavailable"}
            hint="Sum across all tracked channels"
            loading={isInitialLoading}
          />
          <KPICard
            title="30d Views"
            value={overview ? formatCompact(overview.totalViews30d) : "--"}
            change={overview?.viewsGrowth30d}
            provenance={
              connectedChannels.length > 0 ? "live" : "unavailable"
            }
            hint={aggregateHint}
            loading={isInitialLoading}
          />
          <KPICard
            title="30d Watch Hrs"
            value={
              overview ? formatCompact(overview.totalWatchTimeHours30d) : "--"
            }
            provenance={
              connectedChannels.length > 0 ? "live" : "unavailable"
            }
            hint={aggregateHint}
            loading={isInitialLoading}
          />
          <KPICard
            title="30d Revenue"
            value={
              overview ? formatCurrency(overview.totalEstimatedRevenue30d) : "--"
            }
            change={overview?.revenueGrowth30d}
            provenance={
              connectedChannels.length > 0 ? "live" : "unavailable"
            }
            hint={aggregateHint}
            loading={isInitialLoading}
          />
          <KPICard
            title="Avg Engagement"
            value={
              overview ? formatPercent(overview.avgEngagementRate) : "--"
            }
            provenance={
              connectedChannels.length > 0 ? "live" : "unavailable"
            }
            hint={aggregateHint}
            loading={isInitialLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="lg:col-span-2 shadcn-card bg-card">
            <CardHeader className="px-5 pt-5 pb-2 flex-row items-start justify-between space-y-0 gap-3">
              <div className="min-w-0">
                <CardTitle className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
                  {onlyConnected ? (
                    <>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{
                          backgroundColor: deriveAccent(
                            onlyConnected.name,
                            onlyConnected.avatarColor,
                          ),
                        }}
                      />
                      <span className="truncate">
                        {onlyConnected.name} · Daily Views & Subs
                      </span>
                    </>
                  ) : connectedChannels.length === 0 ? (
                    "Daily Views & Subs"
                  ) : (
                    "Cross-Channel Trends"
                  )}
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground font-normal ml-1">
                    30d
                  </span>
                </CardTitle>
                {onlyConnected && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Showing the only channel with a connected Analytics feed.
                    Connect more in Settings to compare.
                  </p>
                )}
              </div>
              {!isInitialLoading &&
                trendsQuery.data &&
                trendsQuery.data.length > 0 &&
                trendsHaveSignal && (
                  <CSVLink
                    data={trendsQuery.data}
                    filename="network-trends.csv"
                    className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:bg-muted shrink-0"
                    aria-label="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </CSVLink>
                )}
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {isInitialLoading ? (
                <Skeleton className="w-full h-[340px]" />
              ) : !trendsHaveSignal ? (
                <ChartEmptyState
                  message="No time-series data yet"
                  hint={
                    connectedChannels.length === 0
                      ? "Connect a YouTube channel in Settings to start collecting daily Analytics."
                      : "Daily metrics will appear here once Analytics has populated."
                  }
                />
              ) : (
                <ResponsiveContainer width="100%" height={340} debounce={0}>
                  <ComposedChart data={trendsQuery.data}>
                    <defs>
                      <linearGradient
                        id="gradientViews"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={
                            onlyConnected
                              ? deriveAccent(
                                  onlyConnected.name,
                                  onlyConnected.avatarColor,
                                )
                              : CHART_COLORS.blue
                          }
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor={
                            onlyConnected
                              ? deriveAccent(
                                  onlyConnected.name,
                                  onlyConnected.avatarColor,
                                )
                              : CHART_COLORS.blue
                          }
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => formatDate(d)}
                      tick={{ fontSize: 11, fill: tickColor }}
                      stroke={tickColor}
                      tickMargin={8}
                      minTickGap={30}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={formatCompact}
                      tick={{ fontSize: 11, fill: tickColor }}
                      stroke={tickColor}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={formatCompact}
                      tick={{ fontSize: 11, fill: tickColor }}
                      stroke={tickColor}
                      tickMargin={8}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      isAnimationActive={false}
                      cursor={{
                        fill: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.05)",
                        stroke: "none",
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalViews"
                      name="Views"
                      fill="url(#gradientViews)"
                      stroke={
                        onlyConnected
                          ? deriveAccent(
                              onlyConnected.name,
                              onlyConnected.avatarColor,
                            )
                          : CHART_COLORS.blue
                      }
                      fillOpacity={1}
                      strokeWidth={2}
                      isAnimationActive={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 0,
                        fill: onlyConnected
                          ? deriveAccent(
                              onlyConnected.name,
                              onlyConnected.avatarColor,
                            )
                          : CHART_COLORS.blue,
                      }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalSubscribers"
                      name="Subscribers"
                      stroke={CHART_COLORS.purple}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 0,
                        fill: CHART_COLORS.purple,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              {trendsHaveSignal && !isInitialLoading && <CustomLegend
                payload={[
                  {
                    value: "Views",
                    color: onlyConnected
                      ? deriveAccent(
                          onlyConnected.name,
                          onlyConnected.avatarColor,
                        )
                      : CHART_COLORS.blue,
                  },
                  { value: "Subscribers", color: CHART_COLORS.purple },
                ]}
              />}
            </CardContent>
          </Card>

          {/* Channel Leaderboard */}
          <div className="space-y-6">
            <Card className="shadcn-card bg-card">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-[15px] font-semibold tracking-tight">
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isInitialLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Leaderboard channels={channels} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cross-channel follower growth (Zernio) — renders only when Zernio
            is connected with the analytics add-on; otherwise hides itself. */}
        <ZernioGrowthPanel days={30} />
      </div>
    </div>
  );
}

/** Quiet legend describing what the colored provenance dots mean on KPI cards. */
function ProvenanceLegend({
  connectedCount,
  totalCount,
}: {
  connectedCount: number;
  totalCount: number;
}) {
  const publicCount = totalCount - connectedCount;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        Data sources:
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
        Live Analytics ({connectedCount})
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
        Public stats only ({publicCount})
      </span>
      <span className="inline-flex items-center gap-1.5 ml-auto font-mono uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-[#52525B]" />
        Unavailable
      </span>
    </div>
  );
}

function ChartEmptyState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="w-full h-[340px] flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-md">
      <p className="text-sm font-medium text-foreground">{message}</p>
      {hint && (
        <p className="text-xs text-muted-foreground max-w-xs text-center px-4">
          {hint}
        </p>
      )}
    </div>
  );
}
