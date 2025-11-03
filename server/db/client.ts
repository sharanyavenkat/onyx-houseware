import * as schema from "@shared/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

// Database file path
const raw = process.env.DATABASE_URL || "server/data/onyx.db";
const dbPath = path.isAbsolute(raw) ? raw : path.resolve(raw);

console.log("✅ Using SQLite DB at:", dbPath);

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
