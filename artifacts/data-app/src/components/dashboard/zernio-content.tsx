import { useEffect, useMemo, useState } from "react";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent } from "@/lib/formatters";

interface ZernioContentPost {
  id: string;
  platform: string;
  accountUsername: string | null;
  title: string;
  publishedAt: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
}

interface ContentResponse {
  overview: { totalPosts: number; publishedPosts: number };
  posts: ZernioContentPost[];
}

const PLATFORM_DOT: Record<string, string> = {
  youtube: "#FF0000",
  instagram: "#E1306C",
  tiktok: "#69C9D0",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
};

type SortKey = "views" | "likes" | "comments" | "engagementRate";

/**
 * Cross-platform content performance, powered by Zernio's post-level analytics.
 * Shows the user's top posts across every connected account with real
 * engagement (views, likes, comments, shares, engagement rate) — data the
 * YouTube-only dashboard never had. Self-hides when Zernio isn't available.
 */
export function ZernioContentPanel({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<ContentResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [sort, setSort] = useState<SortKey>("views");

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/zernio/content?days=${days}&limit=50`)
      .then(async (r) => {
        if (!r.ok) {
          setState("hidden");
          return null;
        }
        return r.json() as Promise<ContentResponse>;
      })
      .then((d) => {
        if (!d || !d.posts || d.posts.length === 0) {
          setState("hidden");
          return;
        }
        setData(d);
        setState("ready");
      })
      .catch(() => setState("hidden"));
  }, [days]);

  const top = useMemo(() => {
    if (!data) return [];
    return [...data.posts].sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0)).slice(0, 8);
  }, [data, sort]);

  if (state === "hidden") return null;

  if (state === "loading") {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Content Performance · Zernio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const sortTabs: { key: SortKey; label: string }[] = [
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "engagementRate", label: "Engagement" },
  ];

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF0000]" />
              Content Performance · Zernio
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Top posts across all platforms · {data?.overview.publishedPosts ?? 0} published · last {days} days
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            {sortTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSort(t.key)}
                className={`px-2 py-1 rounded transition-colors ${
                  sort === t.key
                    ? "bg-foreground/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {top.map((p) => {
            const dot = PLATFORM_DOT[p.platform] ?? "#888";
            const Row = (
              <div className="flex items-center gap-3 py-2.5">
                {p.thumbnailUrl ? (
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    className="w-12 h-12 rounded-md object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${dot}22` }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground tabular-nums">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {formatNumber(p.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {formatNumber(p.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {formatNumber(p.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> {formatNumber(p.shares)}
                    </span>
                    {p.engagementRate > 0 && (
                      <span className="text-emerald-500">{formatPercent(p.engagementRate)} eng</span>
                    )}
                  </div>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wide shrink-0"
                  style={{ color: dot }}
                >
                  {p.platform}
                </span>
              </div>
            );
            return p.url ? (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/30 -mx-2 px-2 rounded">
                {Row}
              </a>
            ) : (
              <div key={p.id}>{Row}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
