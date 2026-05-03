import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapState } from "./bootstrap";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Hydrate OAuth + auto-import channels in the background so server
  // boot is not blocked by external API calls.
  bootstrapState().catch((err) => {
    logger.error({ err }, "bootstrapState failed");
  });
});
