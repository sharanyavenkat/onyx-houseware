import * as schema from "@shared/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env BEFORE reading DATABASE_URL
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, esbuild bundles everything to dist/index.js (not dist/db/client.js)
// So we need to go up one level from dist/ to project root
const envPath = process.env.NODE_ENV === "production" 
  ? path.resolve(__dirname, "../.env")     // Production: dist/index.js -> ../.env
  : path.resolve(__dirname, "../../.env"); // Dev: server/db/client.ts -> ../../.env

dotenv.config({ path: envPath });

// Database file path
const raw = process.env.DATABASE_URL || "server/data/onyx.db";
const dbPath = path.isAbsolute(raw) ? raw : path.resolve(raw);

// Ensure the data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(dbPath);

// Apply PRAGMAs for better performance and reliability
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export the raw sqlite connection for low-level operations
export { sqlite };
