import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";

const router: IRouter = Router();

const COOKIE_NAME = "yt_session";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Simple in-memory rate limiter (5 attempts / 15 min per IP)
interface Attempt { count: number; firstAt: number }
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
const _attempts = new Map<string, Attempt>();

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const a = _attempts.get(ip);
  if (a && now - a.firstAt > RATE_WINDOW_MS) {
    _attempts.delete(ip);
  }
  const cur = _attempts.get(ip);
  if (cur && cur.count >= RATE_MAX) {
    const retryAfterSec = Math.ceil((cur.firstAt + RATE_WINDOW_MS - now) / 1000);
    res.status(429).json({ error: `Too many attempts. Retry in ${retryAfterSec}s.` });
    return;
  }
  next();
}

function recordFailure(req: Request) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const cur = _attempts.get(ip);
  if (!cur) {
    _attempts.set(ip, { count: 1, firstAt: now });
  } else {
    cur.count += 1;
  }
}

export function clearRate(req: Request) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  _attempts.delete(ip);
}

router.post("/auth/verify", rateLimit, (req, res) => {
  const { code } = req.body as { code?: string };
  const expected = process.env["ACCESS_CODE"];

  if (!expected) {
    res.status(500).json({ error: "Access code not configured" });
    return;
  }

  if (!code || code !== expected) {
    recordFailure(req);
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  clearRate(req);

  // Signed cookie — verified server-side via cookie-parser secret
  res.cookie(COOKIE_NAME, "1", {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  res.json({ ok: true });
});

router.get("/auth/check", (req, res) => {
  if (req.signedCookies?.[COOKIE_NAME] === "1") {
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// Middleware to gate API routes (mount before /api/* routes that need auth)
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (req.signedCookies?.[COOKIE_NAME] === "1") {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required" });
}

export default router;
