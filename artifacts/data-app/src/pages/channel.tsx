import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChannels,
  useGetChannelMetrics,
  useGetChannelVideos,
  getGetChannelMetricsQueryKey,
  getGetChannelVideosQueryKey,
} from "@workspace/api-client-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/dashboard/kpi-card";
import {
  DarkModeToggle,
  ExportPdfButton,
  SplitRefreshButton,
  LastRefreshed,
  DateRangeWithPresets,
} from "@/components/dashboard/controls";
import { CustomTooltip } from "@/components/dashboard/charts";
import {
  CHART_COLORS,
  formatCompact,
  formatPercent,
  formatDate,
  isMissing,
  deriveAccent,
  formatNumber,
} from "@/lib/formatters";
import { CSVLink } from "react-csv";
import { Download, AlertCircle, ExternalLink, Lock } from "lucide-react";
import { VideoTable } from "@/components/dashboard/video-table";

function getDarkPref(): boolean {
  try {
    const stored = localStorage.getItem("yt_dark");
    if (stored !== null) return stored === "1";
  } catch {}
  return document.documentElement.classList.contains("dark");
}

export function ChannelPage() {
  const { channelId } = useParams();
  const [, setLocation] = useLocation();
  const [isDark, setIsDark] = useState(getDarkPref);
  const [days, setDays] = useState<number | undefined>(30);
  const queryClient = useQueryClient();

  const channelsQuery = useGetChannels();
  const channels = channelsQuery.data || [];

  useEffect(() => {
    if (!channelId && channels.length > 0) {
      setLocation(`/channels/${channels[0].id}`);
    }
  }, [channelId, channels, setLocation]);

  const activeChannel = channels.find((c) => c.id === channelId);

  const metricsQuery = useGetChannelMetrics(
    channelId || "",
    { days },
    {
      query: {
        queryKey: getGetChannelMetricsQueryKey(channelId || "", { days }),
        enabled: !!channelId,
      },
    },
  );
  const videosQuery = useGetChannelVideos(
    channelId || "",
    {},
    {
      query: {
        queryKey: getGetChannelVideosQueryKey(channelId || "", {}),
        enabled: !!channelId,
      },
    },
  );

  const isInitialLoading =
    channelsQuery.isLoading || metricsQuery.isLoading || videosQuery.isLoading;

  const isBusy =
    channelsQuery.isFetching ||
    metricsQuery.isFetching ||
    videosQuery.isFetching;

  const hasError =
    metricsQuery.isError || videosQuery.isError || channelsQuery.isError;

  const handleRefresh = () => {
    if (!channelId) return;
    queryClient.invalidateQueries({
      queryKey: getGetChannelMetricsQueryKey(channelId, { days }),
    });
    queryClient.invalidateQueries({
      queryKey: getGetChannelVideosQueryKey(channelId, {}),
    });
  };

  // ── Derive flags about what data is real ────────────────────────────────
  const metricsData = metricsQuery.data ?? [];

  // Sum that returns null if every entry is null (vs 0 when all entries are 0).
  const sumNullable = (key: keyof (typeof metricsData)[number]) => {
    if (metricsData.length === 0) return null;
    let total = 0;
    let anyValue = false;
    for (const d of metricsData) {
      const v = (d as unknown as Record<string, unknown>)[key as string];
      if (v === null || v === undefined) continue;
      anyValue = true;
      total += Number(v);
    }
    return anyValue ? total : null;
  };

  const totalViewsForPeriod = useMemo(() => sumNullable("views"), [
    metricsData,
  ]);
  const totalRevenueForPeriod = useMemo(
    () => sumNullable("estimatedRevenue"),
    [metricsData],
  );
  const totalSubsGainedForPeriod = useMemo(
    () => sumNullable("subscribers"),
    [metricsData],
  );

  const avgEngagementForPeriod = useMemo(() => {
    if (metricsData.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const d of metricsData) {
      if (!isMissing(d.engagementRate)) {
        sum += d.engagementRate as number;
        count++;
      }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }, [metricsData]);

  // Does this channel have ANY meaningful time-series data?
  const hasTimeSeries = useMemo(
    () =>
      metricsData.some(
        (d) =>
          (d.views ?? 0) > 0 ||
          (d.subscribers ?? 0) > 0 ||
          (d.estimatedRevenue ?? 0) > 0,
      ),
    [metricsData],
  );

  // Distinguish "has revenue data" from "has zero revenue across the period".
  const hasRevenueSignal = useMemo(
    () =>
      metricsData.some((d) => (d.estimatedRevenue ?? 0) > 0) ||
      metricsData.some((d) => !isMissing(d.estimatedRevenue)),
    [metricsData],
  );

  const channelEmpty =
    !!activeChannel &&
    (activeChannel.totalVideos ?? 0) === 0 &&
    (activeChannel.subscribers ?? 0) === 0 &&
    (activeChannel.totalViews ?? 0) === 0;

  const accent = activeChannel
    ? deriveAccent(activeChannel.name, activeChannel.avatarColor)
    : CHART_COLORS.blue;

  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#e5e5e5";
  const tickColor = isDark ? "#88888b" : "#71717a";

  if (!channelId) {
    return (
      <div className="p-8 text-center">
        <Skeleton className="h-8 w-64 mx-auto mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div className="flex items-center gap-4 min-w-0">
            {isInitialLoading && !activeChannel ? (
              <Skeleton className="w-14 h-14 rounded-lg" />
            ) : (
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0 ${
                  channelEmpty ? "opacity-60 grayscale" : ""
                }`}
                style={{ backgroundColor: accent }}
              >
                {activeChannel?.name?.replace(/^@/, "").charAt(0)?.toUpperCase() ||
                  "C"}
              </div>
            )}
            <div className="min-w-0">
              {isInitialLoading && !activeChannel ? (
                <Skeleton className="h-8 w-48 mb-2" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[26px] font-bold tracking-tight truncate">
                    {activeChannel?.name}
                  </h1>
                  {activeChannel?.url && (
                    <a
                      href={activeChannel.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Open on YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {channelEmpty && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      No Activity
                    </span>
                  )}
                </div>
              )}
              {isInitialLoading && !activeChannel ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <p className="text-muted-foreground mt-1 text-[12px] font-mono">
                  {activeChannel?.handle}
                  {!isMissing(activeChannel?.subscribers) && (
                    <>
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      <span className="tabular-nums">
                        {formatNumber(activeChannel?.subscribers)} subscriber
                        {(activeChannel?.subscribers ?? 0) === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </p>
              )}
              <LastRefreshed updatedAt={metricsQuery.dataUpdatedAt} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 print:hidden flex-wrap">
            <DateRangeWithPresets days={days} onChange={setDays} />
            <div className="w-px h-6 bg-border mx-1" />
            <SplitRefreshButton
              isDark={isDark}
              loading={isInitialLoading || isBusy}
              onRefresh={handleRefresh}
            />
            <ExportPdfButton isDark={isDark} loading={isInitialLoading} />
            <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
          </div>
        </div>

        {/* Error banner */}
        {hasError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Some data failed to load. Try refreshing.
          </div>
        )}

        {/* Empty channel — show a single, deliberate empty state instead of
            a wall of zeroed cards and flat charts. */}
        {!isInitialLoading && channelEmpty && (
          <EmptyChannelState channelName={activeChannel?.name ?? ""} />
        )}

        {/* KPIs — only render when there's something to show. We pick which
            ones are surfaced based on whether the underlying data is real. */}
        {!channelEmpty && (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              title={`${days || 30}d Views`}
              value={
                hasTimeSeries
                  ? formatCompact(totalViewsForPeriod)
                  : formatCompact(activeChannel?.totalViews)
              }
              tone="primary"
              provenance={
                hasTimeSeries ? "live" : isMissing(activeChannel?.totalViews) ? "unavailable" : "public"
              }
              hint={
                hasTimeSeries
                  ? "Daily views from Analytics API"
                  : "Lifetime total — daily Analytics not connected"
              }
              loading={isInitialLoading}
            />
            <KPICard
              title={`${days || 30}d Subs Gained`}
              value={formatCompact(totalSubsGainedForPeriod)}
              provenance={hasTimeSeries ? "live" : "unavailable"}
              loading={isInitialLoading}
            />
            <KPICard
              title="Avg Engagement"
              value={formatPercent(avgEngagementForPeriod)}
              provenance={
                avgEngagementForPeriod !== null ? "live" : "unavailable"
              }
              hint={
                avgEngagementForPeriod === null
                  ? "Connect Analytics for this channel"
                  : undefined
              }
              loading={isInitialLoading}
            />
            <KPICard
              title="Total Videos"
              value={formatNumber(activeChannel?.totalVideos)}
              provenance={
                isMissing(activeChannel?.totalVideos) ? "unavailable" : "public"
              }
              loading={isInitialLoading}
            />
          </div>
        )}

        {/* Charts — hide entirely when empty. Otherwise show only the panels
            with real data; gracefully empty-state the rest. */}
        {!channelEmpty && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Views */}
            <Card className="shadcn-card bg-card lg:col-span-2">
              <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[15px] font-semibold tracking-tight">
                  Daily Views
                </CardTitle>
                {!isInitialLoading && hasTimeSeries && (
                  <CSVLink
                    data={metricsData}
                    filename={`${activeChannel?.handle}-views.csv`}
                    className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:bg-muted"
                    aria-label="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </CSVLink>
                )}
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {isInitialLoading ? (
                  <Skeleton className="w-full h-[260px]" />
                ) : !hasTimeSeries ? (
                  <ChartEmptyState
                    height={260}
                    icon={<Lock className="w-4 h-4" />}
                    message="No daily Analytics for this channel"
                    hint={
                      activeChannel?.platform === "instagram"
                        ? "Instagram exposes account totals (reach, views, engagement) but not a daily breakdown — see the KPI cards above and Content Performance on the Overview."
                        : activeChannel?.platform && activeChannel.platform !== "youtube"
                          ? `${activeChannel.platform} doesn't expose a daily Analytics timeline through Zernio. Account totals are shown in the KPI cards above.`
                          : "Connect this channel's brand account in Settings to see daily views, subs, watch time, and revenue."
                    }
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={260} debounce={0}>
                    <AreaChart data={metricsData}>
                      <defs>
                        <linearGradient
                          id="gradientMetricsViews"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                          <stop
                            offset="100%"
                            stopColor={accent}
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
                        minTickGap={20}
                      />
                      <YAxis
                        tickFormatter={formatCompact}
                        tick={{ fontSize: 11, fill: tickColor }}
                        stroke={tickColor}
                        tickMargin={8}
                        width={45}
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
                        type="monotone"
                        dataKey="views"
                        name="Views"
                        fill="url(#gradientMetricsViews)"
                        stroke={accent}
                        fillOpacity={1}
                        strokeWidth={2}
                        isAnimationActive={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: accent }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6 flex flex-col">
              {/* Subs */}
              <Card className="shadcn-card bg-card flex-1">
                <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    Daily Subs Gained
                  </CardTitle>
                  {!isInitialLoading && hasTimeSeries && (
                    <CSVLink
                      data={metricsData}
                      filename={`${activeChannel?.handle}-subs.csv`}
                      className="print:hidden flex items-center justify-center w-[22px] h-[22px] rounded-[4px] transition-colors hover:bg-muted"
                      aria-label="Export CSV"
                    >
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  {isInitialLoading ? (
                    <Skeleton className="w-full h-[120px]" />
                  ) : !hasTimeSeries ? (
                    <ChartEmptyState height={120} compact message="—" />
                  ) : (
                    <ResponsiveContainer width="100%" height={120} debounce={0}>
                      <LineChart data={metricsData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridColor}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => formatDate(d, "MMM d")}
                          tick={{ fontSize: 10, fill: tickColor }}
                          stroke={tickColor}
                          tickMargin={8}
                          minTickGap={20}
                        />
                        <YAxis
                          tickFormatter={formatCompact}
                          tick={{ fontSize: 10, fill: tickColor }}
                          stroke={tickColor}
                          tickMargin={8}
                          width={35}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          isAnimationActive={false}
                          cursor={{ stroke: tickColor, strokeDasharray: "3 3" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="subscribers"
                          name="Subs"
                          stroke={CHART_COLORS.purple}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                          activeDot={{
                            r: 3,
                            strokeWidth: 0,
                            fill: CHART_COLORS.purple,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Revenue */}
              <Card className="shadcn-card bg-card flex-1">
                <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    Est. Revenue
                  </CardTitle>
                  {!isInitialLoading && hasRevenueSignal && (
                    <CSVLink
                      data={metricsData}
                      filename={`${activeChannel?.handle}-revenue.csv`}
                      className="print:hidden flex items-center justify-center w-[22px] h-[22px] rounded-[4px] transition-colors hover:bg-muted"
                      aria-label="Export CSV"
                    >
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  {isInitialLoading ? (
                    <Skeleton className="w-full h-[120px]" />
                  ) : !hasRevenueSignal ? (
                    <ChartEmptyState
                      height={120}
                      compact
                      message="No monetization data"
                    />
                  ) : (totalRevenueForPeriod ?? 0) === 0 ? (
                    <div className="w-full h-[120px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">
                        $0 across this period
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={120} debounce={0}>
                      <BarChart data={metricsData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridColor}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => formatDate(d, "MMM d")}
                          tick={{ fontSize: 10, fill: tickColor }}
                          stroke={tickColor}
                          tickMargin={8}
                          minTickGap={20}
                        />
                        <YAxis
                          tickFormatter={(v) => `$${formatCompact(v)}`}
                          tick={{ fontSize: 10, fill: tickColor }}
                          stroke={tickColor}
                          tickMargin={8}
                          width={35}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          isAnimationActive={false}
                          cursor={false}
                        />
                        <Bar
                          dataKey="estimatedRevenue"
                          name="Revenue"
                          fill={CHART_COLORS.green}
                          fillOpacity={0.8}
                          radius={[2, 2, 0, 0]}
                          isAnimationActive={false}
                          activeBar={{ fillOpacity: 1 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Video Table */}
        {!channelEmpty && (
          <Card className="shadcn-card bg-card">
            <CardHeader className="px-5 pt-5 pb-2">
              <CardTitle className="text-[15px] font-semibold tracking-tight">
                Recent Videos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {isInitialLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-64 mb-4" />
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <VideoTable
                  data={videosQuery.data || []}
                  accent={accent}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmptyChannelState({ channelName }: { channelName: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center text-center gap-3">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Lock className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {channelName} hasn't published anything yet
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          0 subscribers, 0 videos, 0 views. There's nothing to chart until this
          channel posts content. Once it does, refresh to populate.
        </p>
      </div>
    </div>
  );
}

function ChartEmptyState({
  message,
  hint,
  icon,
  height = 260,
  compact = false,
}: {
  message: string;
  hint?: string;
  icon?: React.ReactNode;
  height?: number;
  compact?: boolean;
}) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-md"
      style={{ height }}
    >
      {icon && (
        <div className="text-muted-foreground/70 mb-1">{icon}</div>
      )}
      <p
        className={`font-medium text-foreground ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {message}
      </p>
      {hint && !compact && (
        <p className="text-xs text-muted-foreground max-w-xs text-center px-4">
          {hint}
        </p>
      )}
    </div>
  );
}
