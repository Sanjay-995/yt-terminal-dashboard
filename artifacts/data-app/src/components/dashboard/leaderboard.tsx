import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { Youtube, Instagram } from "lucide-react";
import {
  deriveAccent,
  formatCompact,
  isMissing,
  NO_DATA,
  type Nullable,
} from "@/lib/formatters";

type Metric = "subscribers" | "totalViews" | "totalVideos";

interface ChannelLite {
  id: string;
  name: string;
  platform?: string;
  avatarColor: string;
  subscribers: Nullable<number>;
  totalViews: Nullable<number>;
  totalVideos: Nullable<number>;
}

const METRIC_META: Record<Metric, { label: string; unit: string }> = {
  subscribers: { label: "Subscribers", unit: "subs" },
  totalViews: { label: "Lifetime Views", unit: "views" },
  totalVideos: { label: "Videos Published", unit: "videos" },
};

interface LeaderboardProps {
  channels: ChannelLite[];
  /** Show "(scale: log)" hint when one channel dwarfs the rest. */
  defaultMetric?: Metric;
}

export function Leaderboard({
  channels,
  defaultMetric = "subscribers",
}: LeaderboardProps) {
  const [metric, setMetric] = useState<Metric>(defaultMetric);

  const sorted = useMemo(() => {
    return [...channels]
      .map((c) => ({ channel: c, value: c[metric] }))
      .sort((a, b) => {
        const av = isMissing(a.value) ? -1 : (a.value as number);
        const bv = isMissing(b.value) ? -1 : (b.value as number);
        return bv - av;
      });
  }, [channels, metric]);

  const maxValue = useMemo(() => {
    let m = 0;
    for (const r of sorted) {
      if (!isMissing(r.value) && (r.value as number) > m)
        m = r.value as number;
    }
    return m;
  }, [sorted]);

  // Determine if we need a log scale: top value is >50x the median non-zero.
  const useLog = useMemo(() => {
    const positives = sorted
      .map((r) => (isMissing(r.value) ? 0 : (r.value as number)))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (positives.length < 3) return false;
    const median = positives[Math.floor(positives.length / 2)] as number;
    return maxValue / Math.max(median, 1) > 50;
  }, [sorted, maxValue]);

  const scaleBar = (v: number) => {
    if (v <= 0) return 0;
    if (!useLog) return Math.max((v / maxValue) * 100, 1.5);
    // Log scale, normalized so maxValue → 100%, 1 → ~6%
    const logMax = Math.log10(maxValue + 1);
    return Math.max((Math.log10(v + 1) / logMax) * 100, 4);
  };

  const meta = METRIC_META[metric];

  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No channels tracked yet. Add one in Settings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-[11px]">
        {(Object.keys(METRIC_META) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-2 py-1 rounded-md font-medium transition-colors ${
              metric === m
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {METRIC_META[m].label}
          </button>
        ))}
        {useLog && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/80 uppercase tracking-wider">
            log scale
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {sorted.map(({ channel, value }) => {
          const accent = deriveAccent(channel.name, channel.avatarColor);
          const missing = isMissing(value);
          const hasValue = !missing && (value as number) > 0;
          const width = missing ? 0 : scaleBar(value as number);
          return (
            <Link
              key={channel.id}
              href={`/channels/${channel.id}`}
              className={`block group ${
                hasValue ? "" : "opacity-50 hover:opacity-100"
              }`}
            >
              <div className="flex justify-between items-center text-[13px] mb-1">
                <span className="font-medium text-foreground truncate group-hover:underline underline-offset-2 flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{channel.name}</span>
                  {channel.platform === "youtube" && <Youtube className="w-3.5 h-3.5 text-[#FF0000] shrink-0" />}
                  {channel.platform === "instagram" && <Instagram className="w-3.5 h-3.5 text-[#E1306C] shrink-0" />}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground shrink-0 ml-2">
                  {missing ? (
                    NO_DATA
                  ) : (
                    <>
                      {formatCompact(value)}{" "}
                      <span className="text-muted-foreground/60">
                        {meta.unit}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${width}%`,
                    backgroundColor: hasValue ? accent : "transparent",
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
