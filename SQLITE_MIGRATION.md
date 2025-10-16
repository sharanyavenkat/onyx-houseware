# SQLite Migration Guide

## Migration Status: Almost Complete ✅

All code has been successfully migrated from PostgreSQL to SQLite except for one protected configuration file that requires manual update.

## Completed Changes

### 1. Dependencies ✅
- ✅ Uninstalled: `@neondatabase/serverless`, `connect-pg-simple`
- ✅ Installed: `@types/better-sqlite3` (better-sqlite3 was already installed)

### 2. Database Schema ✅
- ✅ Updated `shared/schema.ts` to use `sqliteTable`
- ✅ Type conversions:
  - `serial` → `integer` with `autoIncrement` (for numeric IDs: items, customers, orders, etc.)
  - `varchar UUID` → `text` with `crypto.randomUUID()` (for users table - maintains API compatibility)
  - `numeric` → `real`
  - `date` → `text` (ISO 8601 format)
  - `boolean` → `integer` with `{ mode: 'boolean' }`

### 3. Database Client ✅
- ✅ Created `server/db/client.ts` with:
  - better-sqlite3 connection
  - Database file at `./server/data/onyx.db`
  - PRAGMAs: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`

### 4. Storage Layer ✅
- ✅ Updated `server/storage.ts` to import from `server/db/client`
- ✅ User ID type remains `string` (UUID compatible)
- ✅ Removed old `server/db.ts`

### 5. Environment Configuration ✅
- ✅ Updated `.env.example` - removed DATABASE_URL
- ✅ Session storage already uses memory store (no pg-session needed)

## ⚠️ MANUAL STEP REQUIRED

### Update drizzle.config.ts

The `drizzle.config.ts` file is protected and must be manually updated. Replace the entire file content with:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./server/data/onyx.db",
  },
});
```

**Key changes:**
- Removed `DATABASE_URL` check
- Changed `dialect` from `"postgresql"` to `"sqlite"`
- Changed `url` from `process.env.DATABASE_URL` to `"./server/data/onyx.db"`

## Next Steps

After manually updating `drizzle.config.ts`:

1. **Push database schema:**
   ```bash
   npm run db:push
   ```

2. **Verify admin user creation:**
   The admin user will be automatically created on first server start using:
   - Username: from `ADMIN_USERNAME` env var (default: "admin")
   - Password: from `ADMIN_PASSWORD` env var (default: "admin123") - bcrypt hashed

3. **Test the application:**
   - Login should work with admin credentials
   - All CRUD operations should function identically
   - Data is now stored in `./server/data/onyx.db`

## Database Location

- **File:** `./server/data/onyx.db`
- **Journal:** `./server/data/onyx.db-wal` (WAL mode)
- **Shared memory:** `./server/data/onyx.db-shm`

## Benefits of SQLite Migration

✅ No external database service required
✅ Simpler deployment (single file database)
✅ Better performance for local/small deployments
✅ WAL mode enabled for concurrent access
✅ 5-second busy timeout for reliability
