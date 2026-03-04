import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

try {
  const { registerRoutes } = await import("../server/routes");
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
} catch (err: any) {
  console.error("[Vercel] Failed to initialize routes:", err);
  // Expose the error on a catch-all so we can debug
  app.use((_req: Request, res: Response) => {
    res.status(500).json({
      error: "Server initialization failed",
      message: err?.message || String(err),
    });
  });
}

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(status).json({ message });
});

export default app;
