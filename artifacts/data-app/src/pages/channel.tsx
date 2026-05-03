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
  formatCurrency,
  formatPercent,
  formatDate,
} from "@/lib/formatters";
import { CSVLink } from "react-csv";
import { Download, AlertCircle } from "lucide-react";
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
    }
  );
  const videosQuery = useGetChannelVideos(
    channelId || "",
    {},
    {
      query: {
        queryKey: getGetChannelVideosQueryKey(channelId || "", {}),
        enabled: !!channelId,
      },
    }
  );

  // Use isLoading (no data) for skeleton states — isFetching is for background refreshes
  const isInitialLoading =
    channelsQuery.isLoading || metricsQuery.isLoading || videosQuery.isLoading;

  const isBusy =
    channelsQuery.isFetching || metricsQuery.isFetching || videosQuery.isFetching;

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

  // Compute views total for the selected period from daily metrics
  const totalViewsForPeriod = useMemo(
    () => metricsQuery.data?.reduce((sum, d) => sum + d.views, 0) ?? 0,
    [metricsQuery.data]
  );

  // Average engagement from metrics period
  const avgEngagementForPeriod = useMemo(() => {
    const data = metricsQuery.data;
    if (!data || data.length === 0) return activeChannel?.engagementRate ?? 0;
    const sum = data.reduce((s, d) => s + d.engagementRate, 0);
    return Math.round((sum / data.length) * 10) / 10;
  }, [metricsQuery.data, activeChannel]);

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
          <div className="flex items-center gap-4">
            {isInitialLoading && !activeChannel ? (
              <Skeleton className="w-16 h-16 rounded-lg" />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                style={{
                  backgroundColor:
                    activeChannel?.avatarColor || CHART_COLORS.blue,
                }}
              >
                {activeChannel?.name?.charAt(0) || "C"}
              </div>
            )}
            <div>
              {isInitialLoading && !activeChannel ? (
                <Skeleton className="h-8 w-48 mb-2" />
              ) : (
                <h1 className="text-3xl font-bold tracking-tight">
                  {activeChannel?.name}
                </h1>
              )}
              {isInitialLoading && !activeChannel ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <p className="text-muted-foreground mt-1 text-sm font-mono">
                  {activeChannel?.handle} •{" "}
                  {formatCompact(activeChannel?.subscribers || 0)} subs
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

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title={`${days || 30}d Views`}
            value={
              metricsQuery.data
                ? formatCompact(totalViewsForPeriod)
                : activeChannel
                ? formatCompact(activeChannel.totalViews)
                : "--"
            }
            change={activeChannel?.viewsGrowth30d}
            loading={isInitialLoading}
          />
          <KPICard
            title={`${days || 30}d Avg Engagement`}
            value={
              metricsQuery.data
                ? formatPercent(avgEngagementForPeriod)
                : activeChannel
                ? formatPercent(activeChannel.engagementRate)
                : "--"
            }
            loading={isInitialLoading}
          />
          <KPICard
            title="Avg Views/Video"
            value={
              activeChannel
                ? formatCompact(activeChannel.avgViewsPerVideo)
                : "--"
            }
            loading={isInitialLoading}
          />
          <KPICard
            title="Total Videos"
            value={activeChannel?.totalVideos.toLocaleString() || "--"}
            loading={isInitialLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Views Area */}
          <Card className="shadcn-card bg-card lg:col-span-2">
            <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold tracking-tight">
                Daily Views
              </CardTitle>
              {!isInitialLoading &&
                metricsQuery.data &&
                metricsQuery.data.length > 0 && (
                  <CSVLink
                    data={metricsQuery.data}
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
              ) : (
                <ResponsiveContainer width="100%" height={260} debounce={0}>
                  <AreaChart data={metricsQuery.data}>
                    <defs>
                      <linearGradient
                        id="gradientMetricsViews"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={
                            activeChannel?.avatarColor || CHART_COLORS.blue
                          }
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor={
                            activeChannel?.avatarColor || CHART_COLORS.blue
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
                      stroke={activeChannel?.avatarColor || CHART_COLORS.blue}
                      fillOpacity={1}
                      strokeWidth={2}
                      isAnimationActive={false}
                      activeDot={{
                        r: 4,
                        strokeWidth: 0,
                        fill: activeChannel?.avatarColor || CHART_COLORS.blue,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6 flex flex-col">
            {/* Subs Line */}
            <Card className="shadcn-card bg-card flex-1">
              <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  Daily Subs Gained
                </CardTitle>
                {!isInitialLoading &&
                  metricsQuery.data &&
                  metricsQuery.data.length > 0 && (
                    <CSVLink
                      data={metricsQuery.data}
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
                ) : (
                  <ResponsiveContainer width="100%" height={120} debounce={0}>
                    <LineChart data={metricsQuery.data}>
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

            {/* Revenue Bar */}
            <Card className="shadcn-card bg-card flex-1">
              <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  Est. Revenue
                </CardTitle>
                {!isInitialLoading &&
                  metricsQuery.data &&
                  metricsQuery.data.length > 0 && (
                    <CSVLink
                      data={metricsQuery.data}
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
                ) : (
                  <ResponsiveContainer width="100%" height={120} debounce={0}>
                    <BarChart data={metricsQuery.data}>
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

        {/* Video Table */}
        <Card className="shadcn-card bg-card">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              Top Performing Videos
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
              <VideoTable data={videosQuery.data || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
