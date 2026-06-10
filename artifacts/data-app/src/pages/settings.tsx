import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChannels,
  useGetPlatforms,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  getGetChannelsQueryKey,
} from "@workspace/api-client-react";
import type { ChannelSummary, CreateChannelRequest } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, ExternalLink, CheckCircle2, XCircle, RefreshCw, Zap, Youtube, LogOut, Download } from "lucide-react";
import { deriveAccent } from "@/lib/formatters";

const PRESET_COLORS = [
  "#FF0000", "#FFC107", "#E91E63", "#4CAF50", "#9C27B0",
  "#0079F2", "#FF5722", "#00BCD4", "#795EFF", "#FF9800",
];

const PLATFORM_ICONS: Record<string, string> = {
  youtube: "▶",
  tiktok: "♪",
  instagram: "◈",
  twitter: "✦",
  twitch: "◉",
  facebook: "f",
  linkedin: "in",
  pinterest: "P",
};

function PlatformBadge({ platformId, platforms }: { platformId: string; platforms: { id: string; name: string; color: string }[] }) {
  const platform = platforms.find((p) => p.id === platformId);
  if (!platform) return <span className="text-xs text-muted-foreground capitalize">{platformId}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: platform.color + "22", color: platform.color, border: `1px solid ${platform.color}44` }}
    >
      <span>{PLATFORM_ICONS[platform.id] ?? "●"}</span>
      {platform.name}
    </span>
  );
}

interface ChannelFormData {
  name: string;
  handle: string;
  platform: string;
  avatarColor: string;
  url: string;
  subscribers: string;
  totalViews: string;
  totalVideos: string;
}

const emptyForm: ChannelFormData = {
  name: "",
  handle: "",
  platform: "youtube",
  avatarColor: "#0079F2",
  url: "",
  subscribers: "",
  totalViews: "",
  totalVideos: "",
};

function channelToForm(ch: ChannelSummary): ChannelFormData {
  return {
    name: ch.name,
    handle: ch.handle,
    platform: ch.platform,
    avatarColor: ch.avatarColor,
    url: ch.url ?? "",
    subscribers: ch.subscribers.toString(),
    totalViews: ch.totalViews.toString(),
    totalVideos: ch.totalVideos.toString(),
  };
}

interface ZernioAccount {
  id: string;
  name: string;
  handle: string;
  platform: string;
  url: string;
  avatarColor: string;
  profilePicture: string | null;
  subscribers: number;
  totalViews: number;
  totalVideos: number;
  zernioId: string;
}

interface YTChannel {
  id: string;
  name: string;
  handle: string;
  thumbnail: string | null;
  subscribers: number;
  totalViews: number;
  totalVideos: number;
}

interface YTStatus {
  connected: boolean;
  configured: boolean;
  channels?: YTChannel[];
  error?: string;
}

type Tab = "channels" | "platforms" | "zernio" | "youtube";

function getInitialTab(): Tab {
  const p = new URLSearchParams(window.location.search).get("tab");
  if (p === "youtube" || p === "channels" || p === "platforms" || p === "zernio") return p;
  return "channels";
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const channelsQuery = useGetChannels();
  const platformsQuery = useGetPlatforms();
  const createMutation = useCreateChannel();
  const updateMutation = useUpdateChannel();
  const deleteMutation = useDeleteChannel();

  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [addOpen, setAddOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<ChannelSummary | null>(null);
  const [deleteChannel, setDeleteChannelState] = useState<ChannelSummary | null>(null);
  const [form, setForm] = useState<ChannelFormData>(emptyForm);
  const [formError, setFormError] = useState("");

  // Zernio sync state
  const [zernioAccounts, setZernioAccounts] = useState<ZernioAccount[] | null>(null);
  const [zernioStatus, setZernioStatus] = useState<{
    configured: boolean;
    connected: boolean;
    hasAnalyticsAccess: boolean;
    accountCount: number;
    error?: string;
  } | null>(null);
  const [zernioLoading, setZernioLoading] = useState(false);
  const [zernioError, setZernioError] = useState("");
  const [importError, setImportError] = useState("");
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [synced, setSynced] = useState<Set<string>>(new Set());

  // YouTube OAuth state
  const [ytStatus, setYtStatus] = useState<YTStatus | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytImporting, setYtImporting] = useState<Set<string>>(new Set());
  const [ytImported, setYtImported] = useState<Set<string>>(new Set());
  const [ytConnectedBanner, setYtConnectedBanner] = useState(() =>
    new URLSearchParams(window.location.search).get("connected") === "1"
  );
  const [ytUrlError] = useState(() =>
    new URLSearchParams(window.location.search).get("error") ?? ""
  );

  const platforms = platformsQuery.data ?? [];
  const channels = channelsQuery.data ?? [];

  // Auto-load YouTube status when the YouTube tab is active
  useEffect(() => {
    if (tab === "youtube" && ytStatus === null && !ytLoading) {
      void loadYtStatus();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadYtStatus() {
    setYtLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/youtube/status`);
      const data = await res.json() as YTStatus;
      setYtStatus(data);
    } catch {
      setYtStatus({ connected: false, configured: false, error: "Could not reach server" });
    } finally {
      setYtLoading(false);
    }
  }

  async function importYtChannel(ytCh: YTChannel) {
    setYtImporting((s) => new Set(s).add(ytCh.id));
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/youtube/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ytChannelId: ytCh.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setYtImported((s) => new Set(s).add(ytCh.id));
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Import failed: ${err.message ?? "unknown error"}`);
    } finally {
      setYtImporting((s) => { const n = new Set(s); n.delete(ytCh.id); return n; });
    }
  }

  async function disconnectYoutube() {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/auth/youtube/disconnect`, { method: "POST" });
    setYtStatus({ connected: false, configured: ytStatus?.configured ?? false });
    setYtImported(new Set());
    setYtConnectedBanner(false);
  }

  function openAdd() {
    setForm({ ...emptyForm, platform: platforms[0]?.id ?? "youtube" });
    setFormError("");
    setAddOpen(true);
  }

  function openEdit(ch: ChannelSummary) {
    setForm(channelToForm(ch));
    setFormError("");
    setEditChannel(ch);
  }

  function handleField(key: keyof ChannelFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError("");
  }

  function buildPayload(f: ChannelFormData): CreateChannelRequest {
    return {
      name: f.name.trim(),
      handle: f.handle.trim(),
      platform: f.platform,
      avatarColor: f.avatarColor,
      url: f.url.trim() || undefined,
      subscribers: f.subscribers ? parseInt(f.subscribers, 10) : 0,
      totalViews: f.totalViews ? parseInt(f.totalViews, 10) : 0,
      totalVideos: f.totalVideos ? parseInt(f.totalVideos, 10) : 0,
    };
  }

  async function handleAdd() {
    if (!form.name.trim()) { setFormError("Channel name is required"); return; }
    if (!form.handle.trim()) { setFormError("Handle is required"); return; }
    setFormError("");
    try {
      await createMutation.mutateAsync({ data: buildPayload(form) });
      queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setAddOpen(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setFormError(err?.response?.data?.error ?? err?.message ?? "Failed to create channel");
    }
  }

  async function handleEdit() {
    if (!editChannel) return;
    if (!form.name.trim()) { setFormError("Channel name is required"); return; }
    setFormError("");
    try {
      await updateMutation.mutateAsync({ channelId: editChannel.id, data: buildPayload(form) });
      queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setEditChannel(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setFormError(err?.response?.data?.error ?? err?.message ?? "Failed to update channel");
    }
  }

  async function handleDelete() {
    if (!deleteChannel) return;
    try {
      await deleteMutation.mutateAsync({ channelId: deleteChannel.id });
      queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setDeleteChannelState(null);
    } catch {
      setDeleteChannelState(null);
    }
  }

  async function loadZernioAccounts() {
    setZernioLoading(true);
    setZernioError("");
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      // Fetch connection status alongside accounts so the UI can show an honest
      // configured / connected / analytics-add-on banner.
      fetch(`${base}/api/zernio/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => setZernioStatus(s))
        .catch(() => setZernioStatus(null));
      const res = await fetch(`${base}/api/zernio/accounts`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as ZernioAccount[];
      setZernioAccounts(data);
      // Mark already-imported ones
      const existingZernioIds = new Set(
        channels
          .filter((c) => c.id.startsWith("zernio_"))
          .map((c) => c.id)
      );
      setSynced(existingZernioIds);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setZernioError(err.message ?? "Failed to load Zernio accounts");
    } finally {
      setZernioLoading(false);
    }
  }

  async function importZernioAccount(account: ZernioAccount) {
    setSyncing((s) => new Set(s).add(account.id));
    setImportError("");
    try {
      await createMutation.mutateAsync({
        data: {
          name: account.name,
          handle: account.handle,
          platform: account.platform,
          avatarColor: account.avatarColor,
          url: account.url || undefined,
          subscribers: account.subscribers,
          totalViews: account.totalViews,
          totalVideos: account.totalVideos,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setSynced((s) => new Set(s).add(account.id));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setImportError(err?.response?.data?.error ?? err?.message ?? `Failed to import "${account.name}"`);
    } finally {
      setSyncing((s) => { const n = new Set(s); n.delete(account.id); return n; });
    }
  }

  async function importAll() {
    if (!zernioAccounts) return;
    const toImport = zernioAccounts.filter((a) => !synced.has(a.id));
    for (const account of toImport) {
      await importZernioAccount(account);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage tracked channels and platforms</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-md border border-border w-fit flex-wrap">
          {(["channels", "youtube", "zernio", "platforms"] as const).map((t) => (
            <button
              key={t}
              className={`text-sm px-4 py-1.5 rounded-sm capitalize transition-colors flex items-center gap-1.5 ${tab === t ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => {
                setTab(t);
                if (t === "zernio" && !zernioAccounts && !zernioLoading) loadZernioAccounts();
                if (t === "youtube" && ytStatus === null && !ytLoading) void loadYtStatus();
              }}
            >
              {t === "zernio" && <Zap className="w-3 h-3" />}
              {t === "youtube" && <Youtube className="w-3 h-3" />}
              {t === "zernio" ? "Zernio Sync" : t === "youtube" ? "YouTube" : t}
            </button>
          ))}
        </div>

        {/* Channels Tab */}
        {tab === "channels" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {channelsQuery.isLoading ? "Loading..." : `${channels.length} channel${channels.length !== 1 ? "s" : ""} tracked`}
              </div>
              <Button size="sm" onClick={openAdd} className="flex items-center gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Channel
              </Button>
            </div>

            <Card className="bg-card">
              <CardContent className="p-0">
                {channelsQuery.isLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : channels.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No channels yet. Add your first channel or sync from Zernio.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {channels.map((ch) => (
                      <div key={ch.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white shrink-0"
                          style={{ backgroundColor: deriveAccent(ch.name, ch.avatarColor) }}
                        >
                          {ch.name.replace(/^@/, "").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{ch.name}</span>
                            <PlatformBadge platformId={ch.platform} platforms={platforms} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{ch.handle}</span>
                            {ch.url && (
                              <a href={ch.url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                                <ExternalLink className="w-3 h-3" />Visit
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                          <div>
                            <div className="text-xs text-muted-foreground">Followers</div>
                            <div className="text-sm font-mono font-semibold">{ch.subscribers.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Total Views</div>
                            <div className="text-sm font-mono font-semibold">{ch.totalViews.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(ch)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteChannelState(ch)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Zernio Sync Tab */}
        {tab === "zernio" && (
          <div className="space-y-4">
            {zernioStatus && (
              <div
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-4 py-3 rounded-lg border ${
                  zernioStatus.connected
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      zernioStatus.connected ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  {zernioStatus.connected
                    ? "Connected to Zernio"
                    : zernioStatus.configured
                      ? "Key configured · not reachable"
                      : "No API key configured"}
                </span>
                {zernioStatus.connected && (
                  <>
                    <span className="text-muted-foreground">
                      {zernioStatus.accountCount} accounts
                    </span>
                    <span
                      className={
                        zernioStatus.hasAnalyticsAccess
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }
                    >
                      {zernioStatus.hasAnalyticsAccess
                        ? "Analytics add-on active"
                        : "No analytics add-on (follower history unavailable)"}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Import your connected Zernio accounts directly into the dashboard.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {zernioAccounts && zernioAccounts.some((a) => !synced.has(a.id)) && (
                  <Button size="sm" variant="outline" onClick={importAll} className="h-8 text-xs gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Import All
                  </Button>
                )}
                <Button size="sm" onClick={loadZernioAccounts} disabled={zernioLoading} className="h-8 text-xs gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${zernioLoading ? "animate-spin" : ""}`} />
                  {zernioLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>

            {zernioError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg">
                {zernioError}
              </div>
            )}

            {importError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            <Card className="bg-card">
              <CardContent className="p-0">
                {zernioLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !zernioAccounts ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    Click Refresh to load your Zernio accounts.
                  </div>
                ) : zernioAccounts.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No accounts connected in Zernio yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {zernioAccounts.map((account) => {
                      const isImported = synced.has(account.id);
                      const isSyncingThis = syncing.has(account.id);
                      return (
                        <div key={account.id} className="flex items-center gap-4 px-4 py-3.5">
                          {account.profilePicture ? (
                            <img
                              src={account.profilePicture}
                              alt={account.name}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white shrink-0"
                              style={{ backgroundColor: account.avatarColor }}
                            >
                              {account.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground truncate">{account.name}</span>
                              <PlatformBadge platformId={account.platform} platforms={platforms} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono">{account.handle}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.subscribers.toLocaleString()} followers
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isImported ? (
                              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Imported
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={isSyncingThis}
                                onClick={() => importZernioAccount(account)}
                              >
                                {isSyncingThis ? "Importing..." : "Import"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Deep analytics (views, engagement, reach) require the Zernio Analytics add-on. Follower counts are pulled live from your connected accounts.
            </p>
          </div>
        )}

        {/* YouTube OAuth Tab */}
        {tab === "youtube" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Connect your Google account to pull real analytics — views, watch time, revenue, and subscribers — directly from YouTube for channels you own.
              </p>
            </div>

            {/* Success banner from OAuth redirect */}
            {ytConnectedBanner && (
              <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Connected! Select channels below to add them to your dashboard.</span>
                <button className="ml-auto text-green-500/70 hover:text-green-500" onClick={() => setYtConnectedBanner(false)}>✕</button>
              </div>
            )}

            {/* Error banner from OAuth redirect */}
            {ytUrlError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-lg">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{decodeURIComponent(ytUrlError)}</span>
              </div>
            )}

            {/* Status card */}
            <Card className="bg-card">
              <CardContent className="p-5">
                {ytLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ) : !ytStatus ? null : !ytStatus.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FF0000]/15 flex items-center justify-center shrink-0">
                        <Youtube className="w-5 h-5 text-[#FF0000]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">Not configured</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Add <code className="bg-muted px-1 py-0.5 rounded text-xs">YOUTUBE_CLIENT_ID</code> and{" "}
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">YOUTUBE_CLIENT_SECRET</code> as Replit secrets to get started.
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground text-sm">Google Cloud setup (5 min)</p>
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.cloud.google.com</a> → New Project</li>
                        <li>Enable <strong>YouTube Data API v3</strong> + <strong>YouTube Analytics API</strong></li>
                        <li>OAuth consent screen → External → add scopes: <code className="bg-muted px-1 rounded">youtube.readonly</code> &amp; <code className="bg-muted px-1 rounded">yt-analytics.readonly</code></li>
                        <li>Credentials → Create OAuth 2.0 Client ID (Web) → add redirect URI below</li>
                        <li>Copy Client ID + Secret → add as Replit secrets</li>
                      </ol>
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-foreground font-medium mb-1">Redirect URI to add in Google Cloud:</p>
                        <code className="block bg-background border border-border rounded px-3 py-2 text-[11px] break-all select-all">
                          {window.location.origin}/api/auth/youtube/callback
                        </code>
                      </div>
                    </div>
                  </div>
                ) : !ytStatus.connected ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FF0000]/15 flex items-center justify-center shrink-0">
                        <Youtube className="w-5 h-5 text-[#FF0000]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">Not connected</p>
                        {ytStatus.error ? (
                          <p className="text-xs text-destructive mt-0.5">{ytStatus.error}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Connect your Google account to import your channels.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button size="sm" variant="outline" onClick={() => void loadYtStatus()} disabled={ytLoading} className="h-8 text-xs gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${ytLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                      <a
                        href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/youtube`}
                        className="inline-flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-md bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Connect with Google
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">Connected to YouTube</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ytStatus.channels?.length ?? 0} channel{(ytStatus.channels?.length ?? 0) !== 1 ? "s" : ""} found on your account
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => void loadYtStatus()} disabled={ytLoading} className="h-8 text-xs gap-1.5">
                          <RefreshCw className={`w-3.5 h-3.5 ${ytLoading ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void disconnectYoutube()} className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                          <LogOut className="w-3.5 h-3.5" />
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    {/* Channel list */}
                    {ytStatus.channels && ytStatus.channels.length > 0 ? (
                      <div className="border border-border rounded-lg divide-y divide-border">
                        {ytStatus.channels.map((ytCh) => {
                          const isImported = ytImported.has(ytCh.id);
                          const isImportingThis = ytImporting.has(ytCh.id);
                          return (
                            <div key={ytCh.id} className="flex items-center gap-4 px-4 py-3.5">
                              {ytCh.thumbnail ? (
                                <img src={ytCh.thumbnail} alt={ytCh.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#FF0000]/20 flex items-center justify-center text-base font-bold text-[#FF0000] shrink-0">
                                  {ytCh.name.charAt(0)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-foreground truncate">{ytCh.name}</div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="text-xs text-muted-foreground font-mono">{ytCh.handle}</span>
                                  <span className="text-xs text-muted-foreground">{ytCh.subscribers.toLocaleString()} subscribers</span>
                                  <span className="text-xs text-muted-foreground">{ytCh.totalVideos.toLocaleString()} videos</span>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isImported ? (
                                  <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Added
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5"
                                    disabled={isImportingThis}
                                    onClick={() => void importYtChannel(ytCh)}
                                  >
                                    <Download className="w-3 h-3" />
                                    {isImportingThis ? "Adding..." : "Add to Dashboard"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground text-sm border border-border rounded-lg">
                        No channels found on this Google account.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Once added, your channel's dashboard page will show real analytics from YouTube — including revenue if your channel is monetized.
              Data is fetched live from YouTube Analytics API and refreshes each page load.
            </p>
          </div>
        )}

        {/* Platforms Tab */}
        {tab === "platforms" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Supported platforms for channel tracking.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platformsQuery.isLoading ? (
                [...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : (
                platforms.map((platform) => (
                  <Card key={platform.id} className="bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white shrink-0"
                          style={{ backgroundColor: platform.color }}
                        >
                          {PLATFORM_ICONS[platform.id] ?? "●"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{platform.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`flex items-center gap-0.5 text-xs ${platform.supportsAnalytics ? "text-green-500" : "text-muted-foreground"}`}>
                              {platform.supportsAnalytics ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              Analytics
                            </span>
                            <span className={`flex items-center gap-0.5 text-xs ${platform.supportsRevenue ? "text-green-500" : "text-muted-foreground"}`}>
                              {platform.supportsRevenue ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              Revenue
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Channel Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setFormError(""); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Add Channel</DialogTitle></DialogHeader>
          <ChannelForm form={form} onChange={handleField} platforms={platforms} error={formError} />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={isSaving}>
              {isSaving ? "Saving..." : "Add Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={!!editChannel} onOpenChange={(o) => { if (!o) { setEditChannel(null); setFormError(""); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Edit Channel</DialogTitle></DialogHeader>
          <ChannelForm form={form} onChange={handleField} platforms={platforms} error={formError} />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditChannel(null)} disabled={isSaving}>Cancel</Button>
            <Button size="sm" onClick={handleEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteChannel} onOpenChange={(o) => { if (!o) setDeleteChannelState(null); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Remove Channel</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">{deleteChannel?.name}</span>? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteChannelState(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelForm({
  form, onChange, platforms, error,
}: {
  form: ChannelFormData;
  onChange: (key: keyof ChannelFormData, value: string) => void;
  platforms: { id: string; name: string; color: string }[];
  error: string;
}) {
  return (
    <div className="space-y-4 py-2">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {platforms.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange("platform", p.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs font-medium transition-all ${
                form.platform === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              }`}>
              <span className="w-6 h-6 rounded flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: p.color }}>
                {PLATFORM_ICONS[p.id] ?? "●"}
              </span>
              <span className="truncate w-full text-center text-[10px]">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ch-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel Name *</Label>
          <Input id="ch-name" value={form.name} onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. MKBHD" className="h-8 text-sm bg-muted/30 border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-handle" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Handle *</Label>
          <Input id="ch-handle" value={form.handle} onChange={(e) => onChange("handle", e.target.value)}
            placeholder="@handle" className="h-8 text-sm bg-muted/30 border-border" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ch-url" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel URL</Label>
        <Input id="ch-url" value={form.url} onChange={(e) => onChange("url", e.target.value)}
          placeholder="https://youtube.com/@handle" className="h-8 text-sm bg-muted/30 border-border" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ch-subs" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Followers</Label>
          <Input id="ch-subs" type="number" min={0} value={form.subscribers}
            onChange={(e) => onChange("subscribers", e.target.value)} placeholder="0" className="h-8 text-sm bg-muted/30 border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-views" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Views</Label>
          <Input id="ch-views" type="number" min={0} value={form.totalViews}
            onChange={(e) => onChange("totalViews", e.target.value)} placeholder="0" className="h-8 text-sm bg-muted/30 border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-videos" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posts</Label>
          <Input id="ch-videos" type="number" min={0} value={form.totalVideos}
            onChange={(e) => onChange("totalVideos", e.target.value)} placeholder="0" className="h-8 text-sm bg-muted/30 border-border" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button key={color} type="button" onClick={() => onChange("avatarColor", color)}
              className={`w-6 h-6 rounded-full transition-all ${form.avatarColor === color ? "ring-2 ring-offset-1 ring-primary ring-offset-card scale-110" : "hover:scale-110"}`}
              style={{ backgroundColor: color }} aria-label={color} />
          ))}
          <input type="color" value={form.avatarColor} onChange={(e) => onChange("avatarColor", e.target.value)}
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Custom color" />
          <span className="text-xs text-muted-foreground font-mono">{form.avatarColor}</span>
        </div>
      </div>
    </div>
  );
}
