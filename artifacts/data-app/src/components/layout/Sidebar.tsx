import React, { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Activity,
  Settings,
  Sparkles,
  Youtube,
  Instagram,
} from "lucide-react";

/** Tiny platform glyph so same-name channels on different platforms are distinct. */
function PlatformGlyph({ platform }: { platform?: string }) {
  if (platform === "youtube") return <Youtube className="w-3.5 h-3.5 text-[#FF0000] shrink-0" />;
  if (platform === "instagram") return <Instagram className="w-3.5 h-3.5 text-[#E1306C] shrink-0" />;
  return null;
}
import { useGetChannels } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveAccent, formatCompact, isMissing } from "@/lib/formatters";

export function Sidebar() {
  const [location] = useLocation();
  const { data: channels, isLoading } = useGetChannels();

  const sortedChannels = useMemo(() => {
    if (!channels) return [];
    // Show channels with data first, then by subscriber count desc.
    return [...channels].sort((a, b) => {
      const aHas = (a.subscribers ?? 0) > 0 || (a.totalVideos ?? 0) > 0;
      const bHas = (b.subscribers ?? 0) > 0 || (b.totalVideos ?? 0) > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (b.subscribers ?? 0) - (a.subscribers ?? 0);
    });
  }, [channels]);

  return (
    <aside className="w-64 border-r border-border bg-sidebar h-screen sticky top-0 flex flex-col hidden md:flex">
      <div className="px-5 pt-6 pb-5">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span>YT Terminal</span>
        </h2>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1.5 font-mono">
          Mission Control
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        <div>
          <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-1.5">
            Main
          </p>
          <div className="space-y-0.5">
            <NavItem
              href="/"
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="Overview"
              active={location === "/"}
            />
            <NavItem
              href="/insights"
              icon={<Sparkles className="w-4 h-4" />}
              label="Insights"
              active={location === "/insights"}
            />
          </div>
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
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-2 py-1.5 flex items-center gap-2">
                  <Skeleton className="w-5 h-5 rounded-md" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))
            ) : sortedChannels.length ? (
              sortedChannels.map((channel) => {
                const accent = deriveAccent(channel.name, channel.avatarColor);
                const subs = channel.subscribers;
                const hasData =
                  !isMissing(subs) &&
                  ((subs ?? 0) > 0 || (channel.totalVideos ?? 0) > 0);
                return (
                  <ChannelNavItem
                    key={channel.id}
                    href={`/channels/${channel.id}`}
                    name={channel.name}
                    platform={channel.platform}
                    accent={accent}
                    subscribers={subs}
                    hasData={hasData}
                    active={location === `/channels/${channel.id}`}
                  />
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
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ChannelNavItem({
  href,
  name,
  platform,
  accent,
  subscribers,
  hasData,
  active,
}: {
  href: string;
  name: string;
  platform?: string;
  accent: string;
  subscribers: number | null | undefined;
  hasData: boolean;
  active: boolean;
}) {
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <Link
      href={href}
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
        {name}
      </span>
      <PlatformGlyph platform={platform} />
      <span
        className={`shrink-0 text-[10px] font-mono tabular-nums tracking-tight ${
          active ? "text-primary/70" : "text-muted-foreground/70"
        }`}
        title={
          isMissing(subscribers)
            ? "No subscriber data"
            : `${subscribers!.toLocaleString()} subscribers`
        }
      >
        {isMissing(subscribers) ? "—" : formatCompact(subscribers)}
      </span>
    </Link>
  );
}
