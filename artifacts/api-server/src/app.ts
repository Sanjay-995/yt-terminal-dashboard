import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import router from "./routes";
import { requireSession } from "./routes/auth";
import { logger } from "./lib/logger";

const app: Express = express();

// Required for accurate req.ip on Render / behind proxies
app.set("trust proxy", 1);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(sessionSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoints reachable WITHOUT a session (login, OAuth callback, health)
const PUBLIC_API_PATHS = new Set([
  "/api/auth/verify",
  "/api/auth/check",
  "/api/auth/logout",
  "/api/auth/youtube",
  "/api/auth/youtube/callback",
  "/api/healthz",
]);

function apiAuthGate(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) return next();
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  requireSession(req, res, next);
}

app.use(apiAuthGate);
app.use("/api", router);

// Serve the built frontend in production / when SERVE_FRONTEND=1
// Bundled output lives at artifacts/api-server/dist/index.mjs;
// frontend dist is at artifacts/data-app/dist/public.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist =
  process.env["FRONTEND_DIST"] ??
  path.resolve(__dirname, "..", "..", "data-app", "dist", "public");
const shouldServeFrontend =
  process.env["SERVE_FRONTEND"] === "1" ||
  process.env["NODE_ENV"] === "production";

if (shouldServeFrontend && fs.existsSync(frontendDist)) {
  logger.info({ frontendDist }, "Serving frontend statically");
  app.use(express.static(frontendDist));
  // SPA fallback: all non-/api GETs return index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  logger.info({ frontendDist }, "Frontend dist not found / not serving (dev mode)");
}

export default app;
