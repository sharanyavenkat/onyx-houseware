import dotenv from "dotenv";
import express, { NextFunction, type Request, Response } from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { initializeAdmin } from "./auth";
import { bootstrapDatabase } from "./db/bootstrap";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

// Load .env from project root (handles both dev and production)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "../.env") // In production, dist/index.js -> project root
    : path.resolve(__dirname, "../.env"); // In dev, server/index.ts -> project root

dotenv.config({ path: envPath });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Trust proxy when behind reverse proxy (Nginx) in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Require HTTPS in production
      sameSite: "lax", // Allow same-site navigation
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/", // Cookie available for all paths
      domain: undefined, // Don't set domain - let browser handle it
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Bootstrap SQLite database (create tables if they don't exist)
  await bootstrapDatabase();

  // Initialize admin user
  await initializeAdmin();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5001", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
