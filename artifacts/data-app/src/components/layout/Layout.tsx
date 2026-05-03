import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetChannels } from "@workspace/api-client-react";
import {
  Menu,
  Activity,
  LayoutDashboard,
  Settings,
  RadioReceiver,
} from "lucide-react";

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          YT Terminal
        </h2>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Main
          </p>
          <MobileNavItem
            href="/"
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Overview"
            active={location === "/"}
            onClick={onClose}
          />
        </div>

        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Channels
          </p>
          <div className="space-y-1">
            {isLoading ? (
              <p className="px-2 text-sm text-muted-foreground">Loading…</p>
            ) : channels?.length ? (
              channels.map((channel) => (
                <MobileNavItem
                  key={channel.id}
                  href={`/channels/${channel.id}`}
                  icon={<RadioReceiver className="w-4 h-4" />}
                  label={channel.name}
                  active={location === `/channels/${channel.id}`}
                  accentColor={channel.avatarColor}
                  onClick={onClose}
                />
              ))
            ) : (
              <p className="px-2 text-sm text-muted-foreground">
                No channels yet
              </p>
            )}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <MobileNavItem
          href="/settings"
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          active={location === "/settings"}
          onClick={onClose}
        />
      </div>
    </div>
  );
}

function MobileNavItem({
  href,
  icon,
  label,
  active,
  accentColor,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {accentColor ? (
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      ) : (
        icon
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}
