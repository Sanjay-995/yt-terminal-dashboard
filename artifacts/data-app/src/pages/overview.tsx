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
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DarkModeToggle, ExportPdfButton, SplitRefreshButton, LastRefreshed } from "@/components/dashboard/controls";
import { CustomTooltip, CustomLegend } from "@/components/dashboard/charts";
import { CHART_COLORS, formatCompact, formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { CSVLink } from "react-csv";
import { Download, TrendingUp, Users, Eye, Clock, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const DATA_SOURCES = ["YouTube Data API v3", "Analytics DB"];

export function OverviewPage() {
  const [isDark, setIsDark] = useState(true);
  const queryClient = useQueryClient();

  const overviewQuery = useGetOverview();
  const trendsQuery = useGetOverviewTrends({ days: 30 });
  const channelsQuery = useGetChannels();

  const loading = 
    overviewQuery.isLoading || overviewQuery.isFetching ||
    trendsQuery.isLoading || trendsQuery.isFetching ||
    channelsQuery.isLoading || channelsQuery.isFetching;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOverviewTrendsQueryKey({ days: 30 }) });
    queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
  };

  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#e5e5e5";
  const tickColor = isDark ? "#88888b" : "#71717a";

  const sortedChannels = useMemo(() => {
    if (!channelsQuery.data) return [];
    return [...channelsQuery.data].sort((a, b) => b.totalViews - a.totalViews);
  }, [channelsQuery.data]);

  const maxViews = sortedChannels.length > 0 ? sortedChannels[0].totalViews : 1;

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
            <p className="text-muted-foreground mt-1 text-sm">Aggregated performance across 5 tracked channels</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[12px] text-muted-foreground shrink-0">Sources:</span>
              {DATA_SOURCES.map((source) => (
                <span
                  key={source}
                  className="text-[11px] font-semibold rounded px-2 py-0.5 truncate print:!bg-[rgb(229,231,235)] print:!text-[rgb(75,85,99)]"
                  style={{
                    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgb(229, 231, 235)",
                    color: isDark ? "#c8c9cc" : "rgb(75, 85, 99)",
                  }}
                >
                  {source}
                </span>
              ))}
            </div>
            <LastRefreshed updatedAt={overviewQuery.dataUpdatedAt} />
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <SplitRefreshButton isDark={isDark} loading={loading} onRefresh={handleRefresh} />
            <ExportPdfButton isDark={isDark} loading={loading} />
            <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard 
            title="Total Subs" 
            value={overviewQuery.data ? formatCompact(overviewQuery.data.totalSubscribers) : '--'} 
            change={overviewQuery.data?.subscriberGrowth30d} 
            loading={loading}
          />
          <KPICard 
            title="30d Views" 
            value={overviewQuery.data ? formatCompact(overviewQuery.data.totalViews30d) : '--'} 
            change={overviewQuery.data?.viewsGrowth30d} 
            loading={loading}
          />
          <KPICard 
            title="30d Watch Hrs" 
            value={overviewQuery.data ? formatCompact(overviewQuery.data.totalWatchTimeHours30d) : '--'} 
            loading={loading}
          />
          <KPICard 
            title="30d Revenue" 
            value={overviewQuery.data ? formatCurrency(overviewQuery.data.totalEstimatedRevenue30d) : '--'} 
            change={overviewQuery.data?.revenueGrowth30d}
            loading={loading}
          />
          <KPICard 
            title="Avg Engagement" 
            value={overviewQuery.data ? formatPercent(overviewQuery.data.avgEngagementRate) : '--'} 
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="lg:col-span-2 shadcn-card bg-card">
            <CardHeader className="px-5 pt-5 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold tracking-tight">Cross-Channel Trends (30d)</CardTitle>
              {!loading && trendsQuery.data && trendsQuery.data.length > 0 && (
                <CSVLink data={trendsQuery.data} filename="network-trends.csv" className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:bg-muted" aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {loading ? <Skeleton className="w-full h-[340px]" /> : (
                <ResponsiveContainer width="100%" height={340} debounce={0}>
                  <ComposedChart data={trendsQuery.data}>
                    <defs>
                      <linearGradient id="gradientViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} tickMargin={8} minTickGap={30} />
                    <YAxis yAxisId="left" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} tickMargin={8} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} tickMargin={8} />
                    <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', stroke: 'none' }} />
                    <Legend content={<CustomLegend />} />
                    <Area yAxisId="left" type="monotone" dataKey="totalViews" name="Views" fill="url(#gradientViews)" stroke={CHART_COLORS.blue} fillOpacity={1} strokeWidth={2} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.blue }} />
                    <Line yAxisId="right" type="monotone" dataKey="totalSubscribers" name="Subscribers" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.purple }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Channel Ranking */}
          <div className="space-y-6">
            <Card className="shadcn-card bg-card">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-base font-semibold tracking-tight">Channel Leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between"><Skeleton className="h-4 w-24"/><Skeleton className="h-4 w-12"/></div>
                        <Skeleton className="h-2 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortedChannels.map(channel => (
                      <div key={channel.id} className="space-y-1.5">
                        <div className="flex justify-between items-end text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: channel.avatarColor }} />
                            <span className="font-medium text-foreground">{channel.name}</span>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">{formatCompact(channel.totalViews)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${Math.max((channel.totalViews / maxViews) * 100, 2)}%`,
                              backgroundColor: channel.avatarColor 
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Callouts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border p-4 rounded-lg flex flex-col items-start gap-2">
                <div className="p-2 bg-primary/10 rounded-md">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Most Viewed</p>
                  <div className="text-sm font-bold mt-0.5 text-foreground">
                    {loading ? <Skeleton className="h-4 w-20" /> : overviewQuery.data?.topChannelByViews || "N/A"}
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg flex flex-col items-start gap-2">
                <div className="p-2 bg-green-500/10 rounded-md">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Fastest Growth</p>
                  <div className="text-sm font-bold mt-0.5 text-foreground">
                    {loading ? <Skeleton className="h-4 w-20" /> : overviewQuery.data?.topChannelByGrowth || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
