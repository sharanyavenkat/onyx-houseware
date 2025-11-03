# SQLite Migration Guide

## Migration Status: Complete ✅

All code has been successfully migrated from PostgreSQL to SQLite.
The system now supports both **local** and **production** database paths through the `DATABASE_URL` environment variable.

---

## Completed Changes

### 1. Dependencies ✅

- ✅ Uninstalled: `@neondatabase/serverless`, `connect-pg-simple`
- ✅ Installed: `@types/better-sqlite3` (better-sqlite3 already included)

### 2. Database Schema ✅

- ✅ Updated `shared/schema.ts` to use `sqliteTable`
- ✅ Type conversions:
  - `serial` → `integer` with `autoIncrement`
  - `uuid` → `text` using `crypto.randomUUID()`
  - `numeric` → `real`
  - `date` → `text` (ISO 8601 format)
  - `boolean` → `integer` with `{ mode: 'boolean' }`

### 3. Database Client ✅

- ✅ Created `server/db/client.ts` with:
  - `better-sqlite3` connection
  - Environment-aware database path:
    - **Development:** `server/data/onyx.db`
    - **Production (Lightsail):** `/var/app/data/onyx.db`
  - PRAGMAs: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`

### 4. Storage Layer ✅

- ✅ Updated `server/storage.ts` to import from `server/db/client`
- ✅ User ID type remains `string` (UUID compatible)
- ✅ Removed legacy `server/db.ts`

### 5. Environment Configuration ✅

- ✅ `.env.example` simplified
- ✅ Database path now controlled via `DATABASE_URL`

Example:

```env
# Local
DATABASE_URL=server/data/onyx.db

# Production
DATABASE_URL=/var/app/data/onyx.db
```
