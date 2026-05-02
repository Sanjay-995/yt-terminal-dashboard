import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number; // percentage as number (e.g. 12.5 for 12.5%)
  loading?: boolean;
}

export function KPICard({ title, value, change, loading }: KPICardProps) {
  return (
    <Card className="shadcn-card bg-card hover:bg-muted/30 transition-colors duration-200">
      <CardContent className="p-6">
        {loading ? (
          <>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{title}</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold tracking-tight" style={{ color: "#0079F2" }}>
                {value}
              </p>
              {change !== undefined && (
                <WoWChange value={change} />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WoWChange({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value >= 0;
  const accentColor = up ? "#009118" : "#A60808";
  return (
    <div className="flex items-center gap-1 pb-1" style={{ fontSize: "13px", color: accentColor, fontWeight: 600 }}>
      {up ? <ArrowUpIcon className="w-3.5 h-3.5" /> : <ArrowDownIcon className="w-3.5 h-3.5" />}
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
}
