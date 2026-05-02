import React, { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, ExternalLink, CheckCircle2, XCircle } from "lucide-react";

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
  if (!platform) return <span className="text-xs text-muted-foreground">{platformId}</span>;
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

export function SettingsPage() {
  const queryClient = useQueryClient();
  const channelsQuery = useGetChannels();
  const platformsQuery = useGetPlatforms();
  const createMutation = useCreateChannel();
  const updateMutation = useUpdateChannel();
  const deleteMutation = useDeleteChannel();

  const [tab, setTab] = useState<"channels" | "platforms">("channels");
  const [addOpen, setAddOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<ChannelSummary | null>(null);
  const [deleteChannel, setDeleteChannelState] = useState<ChannelSummary | null>(null);
  const [form, setForm] = useState<ChannelFormData>(emptyForm);
  const [formError, setFormError] = useState("");

  const platforms = platformsQuery.data ?? [];
  const channels = channelsQuery.data ?? [];

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
    } catch (e: any) {
      setFormError(e?.response?.data?.error ?? e?.message ?? "Failed to create channel");
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
    } catch (e: any) {
      setFormError(e?.response?.data?.error ?? e?.message ?? "Failed to update channel");
    }
  }

  async function handleDelete() {
    if (!deleteChannel) return;
    try {
      await deleteMutation.mutateAsync({ channelId: deleteChannel.id });
      queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      setDeleteChannelState(null);
    } catch (e: any) {
      setDeleteChannelState(null);
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
        <div className="flex gap-1 bg-muted p-1 rounded-md border border-border w-fit">
          {(["channels", "platforms"] as const).map((t) => (
            <button
              key={t}
              className={`text-sm px-4 py-1.5 rounded-sm capitalize transition-colors ${tab === t ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab(t)}
            >
              {t}
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

            <Card className="shadcn-card bg-card">
              <CardContent className="p-0">
                {channelsQuery.isLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : channels.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">
                    No channels yet. Add your first channel to get started.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {channels.map((ch) => (
                      <div key={ch.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold text-white shrink-0"
                          style={{ backgroundColor: ch.avatarColor }}
                        >
                          {ch.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{ch.name}</span>
                            <PlatformBadge platformId={ch.platform} platforms={platforms} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{ch.handle}</span>
                            {ch.url && (
                              <a
                                href={ch.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Visit
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                          <div>
                            <div className="text-xs text-muted-foreground">Subscribers</div>
                            <div className="text-sm font-mono font-semibold">{ch.subscribers.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Total Views</div>
                            <div className="text-sm font-mono font-semibold">{ch.totalViews.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(ch)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Edit channel"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteChannelState(ch)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            aria-label="Delete channel"
                          >
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

        {/* Platforms Tab */}
        {tab === "platforms" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Supported platforms for channel tracking. Each channel you add can be assigned to one of these platforms.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platformsQuery.isLoading ? (
                [...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : (
                platforms.map((platform) => (
                  <Card key={platform.id} className="shadcn-card bg-card">
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
          <DialogHeader>
            <DialogTitle>Add Channel</DialogTitle>
          </DialogHeader>
          <ChannelForm
            form={form}
            onChange={handleField}
            platforms={platforms}
            error={formError}
          />
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
          <DialogHeader>
            <DialogTitle>Edit Channel</DialogTitle>
          </DialogHeader>
          <ChannelForm
            form={form}
            onChange={handleField}
            platforms={platforms}
            error={formError}
          />
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
          <DialogHeader>
            <DialogTitle>Remove Channel</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">{deleteChannel?.name}</span> from tracking? This cannot be undone.
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
  form,
  onChange,
  platforms,
  error,
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

      {/* Platform */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange("platform", p.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs font-medium transition-all ${
                form.platform === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className="w-6 h-6 rounded flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: p.color }}
              >
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
          <Input
            id="ch-name"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. MKBHD"
            className="h-8 text-sm bg-muted/30 border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-handle" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Handle *</Label>
          <Input
            id="ch-handle"
            value={form.handle}
            onChange={(e) => onChange("handle", e.target.value)}
            placeholder="@handle"
            className="h-8 text-sm bg-muted/30 border-border"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ch-url" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel URL</Label>
        <Input
          id="ch-url"
          value={form.url}
          onChange={(e) => onChange("url", e.target.value)}
          placeholder="https://youtube.com/@handle"
          className="h-8 text-sm bg-muted/30 border-border"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ch-subs" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscribers</Label>
          <Input
            id="ch-subs"
            type="number"
            min={0}
            value={form.subscribers}
            onChange={(e) => onChange("subscribers", e.target.value)}
            placeholder="0"
            className="h-8 text-sm bg-muted/30 border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-views" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Views</Label>
          <Input
            id="ch-views"
            type="number"
            min={0}
            value={form.totalViews}
            onChange={(e) => onChange("totalViews", e.target.value)}
            placeholder="0"
            className="h-8 text-sm bg-muted/30 border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-videos" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Videos</Label>
          <Input
            id="ch-videos"
            type="number"
            min={0}
            value={form.totalVideos}
            onChange={(e) => onChange("totalVideos", e.target.value)}
            placeholder="0"
            className="h-8 text-sm bg-muted/30 border-border"
          />
        </div>
      </div>

      {/* Avatar Color */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange("avatarColor", color)}
              className={`w-6 h-6 rounded-full transition-all ${form.avatarColor === color ? "ring-2 ring-offset-1 ring-primary ring-offset-card scale-110" : "hover:scale-110"}`}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
          <input
            type="color"
            value={form.avatarColor}
            onChange={(e) => onChange("avatarColor", e.target.value)}
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
            title="Custom color"
          />
          <span className="text-xs text-muted-foreground font-mono">{form.avatarColor}</span>
        </div>
      </div>
    </div>
  );
}
