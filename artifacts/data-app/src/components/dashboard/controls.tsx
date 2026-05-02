import React, { useState, useEffect, useRef } from "react";
import { Sun, Moon, Printer, RefreshCw, ChevronDown, Check, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

export function DarkModeToggle({ isDark, setIsDark }: { isDark: boolean; setIsDark: (v: boolean | ((prev: boolean) => boolean)) => void }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((d) => !d)}
      className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
        color: isDark ? "#c8c9cc" : "#4b5563",
      }}
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}

export function ExportPdfButton({ isDark, loading = false }: { isDark: boolean; loading?: boolean }) {
  return (
    <button
      onClick={() => window.print()}
      disabled={loading}
      className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors disabled:opacity-50"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
        color: isDark ? "#c8c9cc" : "#4b5563",
      }}
      aria-label="Export as PDF"
    >
      <Printer className="w-3.5 h-3.5" />
    </button>
  );
}

const INTERVAL_OPTIONS = [
  { label: "Every 30 sec", ms: 30 * 1000 },
  { label: "Every 1 min", ms: 60 * 1000 },
  { label: "Every 5 min", ms: 5 * 60 * 1000 },
];

export function SplitRefreshButton({ isDark, loading, onRefresh }: { isDark: boolean; loading: boolean; onRefresh: () => void }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [autoRefreshMs, setAutoRefreshMs] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (loading) {
      setIsSpinning(true);
    } else {
      const t = setTimeout(() => setIsSpinning(false), 600);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const interval = setInterval(() => {
      onRefresh();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, onRefresh]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="flex items-center rounded-[6px] overflow-hidden h-[26px] text-[12px]"
        style={{
          backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
          color: isDark ? "#c8c9cc" : "#4b5563",
        }}
      >
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1 px-2 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }} />
        <button onClick={() => setDropdownOpen((o) => !o)} className="flex items-center justify-center px-1.5 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {dropdownOpen && (
        <div 
          className="absolute right-0 top-8 w-48 bg-popover border border-border rounded-md shadow-md overflow-hidden z-50 text-sm"
          style={{ backgroundColor: isDark ? "#121214" : "#ffffff", color: isDark ? "#f3f4f6" : "#111827" }}
        >
          <div className="p-2 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auto-Refresh</span>
          </div>
          <div className="p-1">
            <button 
              className={`w-full text-left px-2 py-1.5 rounded-sm flex items-center justify-between hover:bg-muted transition-colors ${autoRefreshMs === null ? "bg-muted" : ""}`}
              onClick={() => { setAutoRefreshMs(null); setDropdownOpen(false); }}
            >
              <span>Off</span>
              {autoRefreshMs === null && <Check className="w-4 h-4" />}
            </button>
            {INTERVAL_OPTIONS.map(opt => (
              <button 
                key={opt.ms}
                className={`w-full text-left px-2 py-1.5 rounded-sm flex items-center justify-between hover:bg-muted transition-colors ${autoRefreshMs === opt.ms ? "bg-muted" : ""}`}
                onClick={() => { setAutoRefreshMs(opt.ms); setDropdownOpen(false); }}
              >
                <span>{opt.label}</span>
                {autoRefreshMs === opt.ms && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LastRefreshed({ updatedAt }: { updatedAt?: number }) {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  
  return (
    <p className="text-[12px] text-muted-foreground mt-3">Last refresh: {time} on {date}</p>
  );
}

export function DateRangeWithPresets({ 
  days, 
  onChange 
}: { 
  days: number | undefined; 
  onChange: (days: number | undefined) => void 
}) {
  const presets = [
    { label: "Last 7 days", value: 7 },
    { label: "Last 14 days", value: 14 },
    { label: "Last 30 days", value: 30 },
  ];

  return (
    <div className="flex gap-1 bg-muted p-1 rounded-md border border-border">
      {presets.map((preset) => (
        <button
          key={preset.label}
          className={`text-xs px-3 py-1.5 rounded-sm transition-colors ${days === preset.value ? 'bg-background shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => onChange(preset.value)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
