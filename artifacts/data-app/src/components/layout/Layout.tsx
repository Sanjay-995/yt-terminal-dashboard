import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetChannels } from "@workspace/api-client-react";
import {
  Menu,
  Activity,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";
import { deriveAccent, formatCompact, isMissing } from "@/lib/formatters";

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2 text-primary font-bold tracking-tight">
            <Activity className="w-5 h-5" />
            <span>YT Terminal</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        </header>

        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>

      {/* Mobile nav drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-64 bg-sidebar border-r border-border"
        >
          <MobileNav onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const { data: channels, isLoading } = useGetChannels();

  const sortedChannels = useMemo(() => {
    if (!channels) return [];
    return [...channels].sort((a, b) => {
      const aHas = (a.subscribers ?? 0) > 0 || (a.totalVideos ?? 0) > 0;
      const bHas = (b.subscribers ?? 0) > 0 || (b.totalVideos ?? 0) > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (b.subscribers ?? 0) - (a.subscribers ?? 0);
    });
  }, [channels]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          YT Terminal
        </h2>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1.5 font-mono">
          Mission Control
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <div>
          <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-1.5">
            Main
          </p>
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </Link>
          <Link
            href="/insights"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location === "/insights"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Insights</span>
          </Link>
        </div>

        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
              Channels
            </p>
            {!isLoading && sortedChannels.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {sortedChannels.length}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            {isLoading ? (
              <p className="px-2 text-sm text-muted-foreground">Loading…</p>
            ) : sortedChannels.length ? (
              sortedChannels.map((channel) => {
                const accent = deriveAccent(channel.name, channel.avatarColor);
                const subs = channel.subscribers;
                const hasData =
                  !isMissing(subs) &&
                  ((subs ?? 0) > 0 || (channel.totalVideos ?? 0) > 0);
                const initial =
                  channel.name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
                const active = location === `/channels/${channel.id}`;
                return (
                  <Link
                    key={channel.id}
                    href={`/channels/${channel.id}`}
                    onClick={onClose}
                    className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : hasData
                        ? "text-foreground/80 hover:text-foreground hover:bg-muted"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono tracking-tighter text-white ${
                        hasData ? "" : "opacity-40 grayscale"
                      }`}
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <span className="truncate flex-1 text-[13px] font-medium leading-tight">
                      {channel.name}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-mono tabular-nums tracking-tight ${
                        active ? "text-primary/70" : "text-muted-foreground/70"
                      }`}
                    >
                      {isMissing(subs) ? "—" : formatCompact(subs)}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="px-2 text-sm text-muted-foreground">
                No channels yet
              </p>
            )}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-border">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex items-center gap-2 px-2 py-1.5 text-sm font-medium transition-colors w-full rounded-md ${
            location === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </div>
  );
}
