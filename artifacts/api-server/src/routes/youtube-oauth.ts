import { Router, type IRouter } from "express";
import {
  setTokens,
  clearTokens,
  isConnected,
  getMyChannels,
} from "../lib/youtube-client";
import { addOrUpdateYouTubeChannel } from "./youtube";

const router: IRouter = Router();

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

function getRedirectUri(req: { protocol: string; get: (h: string) => string | undefined }): string {
  // Use REPLIT_DOMAINS when available (covers both dev preview and production)
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const primary = domains.split(",")[0]!.trim();
    return `https://${primary}/api/auth/youtube/callback`;
  }
  return `${req.protocol}://${req.get("host") ?? "localhost"}/api/auth/youtube/callback`;
}

// ─── Start OAuth flow ─────────────────────────────────────────────────────────

router.get("/auth/youtube", (req, res) => {
  const clientId = process.env["YOUTUBE_CLIENT_ID"];
  if (!clientId) {
    res.status(503).json({
      error: "YOUTUBE_CLIENT_ID secret is not configured. Add it in Replit Secrets.",
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // always prompt so we get a refresh_token
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ─── OAuth callback ───────────────────────────────────────────────────────────

router.get("/auth/youtube/callback", async (req, res) => {
  const { code, error } = req.query as { code?: string; error?: string };
  const settingsBase = "/settings?tab=youtube";

  if (error || !code) {
    const msg = encodeURIComponent(error ?? "Authorization was denied");
    res.redirect(`${settingsBase}&error=${msg}`);
    return;
  }

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env["YOUTUBE_CLIENT_ID"],
        client_secret: process.env["YOUTUBE_CLIENT_SECRET"],
        redirect_uri: getRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const detail = await tokenResp.text().catch(() => "");
      const msg = encodeURIComponent(`Token exchange failed: ${detail}`);
      res.redirect(`${settingsBase}&error=${msg}`);
      return;
    }

    const tokens = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    if (!tokens.refresh_token) {
      const msg = encodeURIComponent(
        "No refresh token received. Revoke app access at myaccount.google.com/permissions and try again."
      );
      res.redirect(`${settingsBase}&error=${msg}`);
      return;
    }

    setTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });

    res.redirect(`${settingsBase}&connected=1`);
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "Unknown error");
    res.redirect(`${settingsBase}&error=${msg}`);
  }
});

// ─── Connection status + channel list ────────────────────────────────────────

router.get("/auth/youtube/status", async (_req, res) => {
  if (!isConnected()) {
    const configured = !!(
      process.env["YOUTUBE_CLIENT_ID"] && process.env["YOUTUBE_CLIENT_SECRET"]
    );
    res.json({ connected: false, configured });
    return;
  }

  try {
    const channels = await getMyChannels();
    res.json({ connected: true, configured: true, channels });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.json({ connected: false, configured: true, error: msg });
  }
});

// ─── Import a YouTube channel into the dashboard ──────────────────────────────

router.post("/auth/youtube/import", async (req, res) => {
  if (!isConnected()) {
    res.status(401).json({ error: "Not connected to YouTube. Connect in Settings first." });
    return;
  }

  const { ytChannelId } = req.body as { ytChannelId?: string };
  if (!ytChannelId) {
    res.status(400).json({ error: "ytChannelId is required" });
    return;
  }

  try {
    const channels = await getMyChannels();
    const ytCh = channels.find((c) => c.id === ytChannelId);
    if (!ytCh) {
      res.status(404).json({ error: "Channel not found in your YouTube account" });
      return;
    }

    const channel = addOrUpdateYouTubeChannel(ytCh);
    res.status(201).json(channel);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(502).json({ error: msg });
  }
});

// ─── Disconnect ───────────────────────────────────────────────────────────────

router.post("/auth/youtube/disconnect", (_req, res) => {
  clearTokens();
  res.json({ ok: true });
});

export default router;
