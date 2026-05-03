import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { isMissing, NO_DATA, type Nullable } from "@/lib/formatters";

export type KPIProvenance =
  | "live"        // pulled directly from a connected Analytics API (trustworthy)
  | "public"      // derived from public stats (subs / total views) — coarse but real
  | "unavailable" // we have no data for this metric on this channel
  | "unknown";    // not specified

interface KPICardProps {
  title: string;
  /** Pre-formatted value string. Use NO_DATA ("—") when unknown. */
  value: string | number;
  /** Period-over-period change in percent. Hidden when missing or zero. */
  change?: Nullable<number>;
  /** Short caption shown under the value, e.g. "from connected Analytics". */
  hint?: string;
  /** Visual prominence. "primary" gets the accent color & larger type. */
  tone?: "primary" | "default";
  /** Where this value comes from. Drives the provenance dot. */
  provenance?: KPIProvenance;
  loading?: boolean;
}

const PROVENANCE_META: Record<
  KPIProvenance,
  { color: string; label: string }
> = {
  live: { color: "#22C55E", label: "Live from Analytics API" },
  public: { color: "#94A3B8", label: "From public channel stats" },
  unavailable: { color: "#52525B", label: "No data — connect channel" },
  unknown: { color: "transparent", label: "" },
};

export function KPICard({
  title,
  value,
  change,
  hint,
  tone = "default",
  provenance = "unknown",
  loading,
}: KPICardProps) {
  const isUnavailable =
    !loading && (value === NO_DATA || value === "" || value == null);
  const meta = PROVENANCE_META[provenance];

  return (
    <Card
      className={`shadcn-card bg-card transition-colors duration-200 ${
        isUnavailable
          ? "opacity-60 hover:opacity-100"
          : "hover:bg-muted/30"
      }`}
    >
      <CardContent className="p-5">
        {loading ? (
          <>
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
                {title}
              </p>
              {provenance !== "unknown" && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: meta.color }}
                  title={meta.label}
                  aria-label={meta.label}
                />
              )}
            </div>
            <div className="flex items-end justify-between mt-2 gap-2">
              <p
                className={`font-mono tabular-nums tracking-tight leading-none ${
                  tone === "primary" ? "text-4xl" : "text-2xl"
                } ${
                  isUnavailable
                    ? "text-muted-foreground/60 font-normal"
                    : tone === "primary"
                    ? "font-bold text-foreground"
                    : "font-semibold text-foreground"
                }`}
              >
                {isUnavailable ? NO_DATA : value}
              </p>
              {!isUnavailable && <WoWChange value={change} />}
            </div>
            {hint && (
              <p className="text-[11px] text-muted-foreground mt-2">
                {hint}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WoWChange({ value }: { value: Nullable<number> }) {
  // Hide entirely if missing or effectively zero — never fake a green arrow.
  if (isMissing(value) || Math.abs(value as number) < 0.05) return null;
  const v = value as number;
  const up = v >= 0;
  const accentColor = up ? "#22C55E" : "#EF4444";
  return (
    <div
      className="flex items-center gap-0.5 pb-1 font-mono tabular-nums"
      style={{ fontSize: "12px", color: accentColor, fontWeight: 600 }}
    >
      {up ? (
        <ArrowUpIcon className="w-3 h-3" />
      ) : (
        <ArrowDownIcon className="w-3 h-3" />
      )}
      <span>{Math.abs(v).toFixed(1)}%</span>
    </div>
  );
}
