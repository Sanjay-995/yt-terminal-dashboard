import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, RadioReceiver, Activity, Settings, Plus } from "lucide-react";
import { useGetChannels } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Sidebar() {
  const [location] = useLocation();
  const { data: channels, isLoading } = useGetChannels();

  return (
    <aside className="w-64 border-r border-border bg-sidebar h-screen sticky top-0 flex flex-col hidden md:flex">
      <div className="p-6">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          YT Terminal
        </h2>
      </div>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Main</p>
          <div className="space-y-1">
            <NavItem href="/" icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active={location === "/"} />
          </div>
        </div>

        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Channels</p>
          <div className="space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-2 py-1.5 flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            ) : channels?.length ? (
              channels.map(channel => (
                <NavItem 
                  key={channel.id} 
                  href={`/channels/${channel.id}`} 
                  icon={<RadioReceiver className="w-4 h-4" />} 
                  label={channel.name} 
                  active={location === `/channels/${channel.id}`}
                  accentColor={channel.avatarColor}
                />
              ))
            ) : (
              <p className="px-2 text-sm text-muted-foreground">No channels found</p>
            )}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <Link
          href="/settings"
          className={`flex items-center gap-2 px-2 py-1.5 text-sm font-medium transition-colors w-full rounded-md ${location === "/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active, accentColor }: { href: string; icon: React.ReactNode; label: string; active: boolean; accentColor?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
      {accentColor ? (
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
      ) : (
        icon
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}
