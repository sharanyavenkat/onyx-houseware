# Overview

This is an Onyx Houseware order management system - a mini CRM web application designed for a cookware manufacturing company. The system manages orders, items, customers, and inventory indenting with a focus on production planning and fulfillment tracking.

The application provides functionality for:
- Managing product catalog (items) with SKUs, pricing, and safety stock levels
- Customer relationship management with company details
- Order management with purchase order tracking and status workflow
- Monthly inventory planning (indent) with automatic order quantity calculations
- Shipment tracking for order fulfillment with rejection tracking

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework and Build Tools:**
- React with TypeScript
- Vite as the build tool and development server
- Wouter for lightweight client-side routing

**UI and Styling:**
- Shadcn/ui component library built on Radix UI primitives
- TailwindCSS with custom design system
- Material Design principles adapted for enterprise applications
- Custom dark/light mode theming via CSS variables
- Inter font family from Google Fonts
- Utility-focused design approach prioritizing clarity over aesthetics

**State Management:**
- TanStack Query (React Query) for all server state management
- No global client state - form state managed locally with React hooks
- Optimistic updates and automatic cache invalidation

**Design Philosophy:**
- Enterprise-focused with data density prioritized
- Consistent spacing using Tailwind units (2, 4, 6, 8, 12)
- Status colors: green (fulfilled), amber (draft/pending), red (cancelled), cyan (info)
- 12-column responsive grid system
- Monospace font for numerical data in tables

## Backend Architecture

**Runtime and Framework:**
- Node.js with Express.js server
- TypeScript with ES modules
- Single monorepo structure with shared types between client and server

**API Design:**
- RESTful endpoints under `/api/*` prefix
- Zod validation for all POST/PUT/PATCH payloads (returns 422 on validation failure)
- Session-based authentication required for all API routes
- Consistent error handling with descriptive messages

**Database Layer:**
- SQLite as the database engine (migrated from PostgreSQL)
- Drizzle ORM with better-sqlite3 driver for synchronous operations
- Schema definitions centralized in `shared/schema.ts`
- WAL (Write-Ahead Logging) mode enabled for performance
- 5-second busy timeout and foreign keys enabled
- Environment-aware database path:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` or path from `DATABASE_URL` env var

**Data Models:**
- Users: UUID-based IDs with bcrypt-hashed passwords
- Items: Auto-increment IDs, SKU uniqueness, active/inactive flag
- Customers: Auto-increment IDs, only company_name required
- Orders: Header/line-item pattern, unique PO numbers, status workflow
- Order Items: Links orders to items with quantities
- Indents: Monthly inventory planning per item
- Shipments: Tracks partial fulfillments with lot numbers and rejection counts

## Authentication System

**Single Admin Model:**
- One shared admin account for the entire system
- Credentials stored in environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- Password hashing via bcrypt with 12 salt rounds
- Admin user auto-created on first startup if not exists

**Session Management:**
- Express-session with in-memory store (MemoryStore)
- HTTP-only cookies for security
- 24-hour session expiration
- Multiple concurrent sessions allowed (same user can login from multiple devices)
- Secure cookies enabled in production mode

**Authentication Flow:**
- Login-only flow (no signup endpoint)
- `/api/auth/login` and `/api/auth/logout` are public routes
- All other `/api/*` routes require authentication via `requireAuth` middleware
- Returns 401 for unauthenticated requests
- Frontend redirects to login page when auth fails

## Database Schema

**Core Tables:**
- `users`: Single admin user with UUID ID
- `items`: Product catalog with SKU, type, size, price, safety stock, active status
- `customers`: Company information (company_name required, other fields optional)
- `orders`: Order headers with PO number, customer reference, dates, status
- `order_items`: Line items linking orders to items with quantities
- `indents`: Monthly inventory planning with opening balance and expected receipts
- `shipments`: Fulfillment tracking with lot numbers, quantities, rejection counts

**Type Conversions (PostgreSQL → SQLite):**
- `serial` → `integer` with `autoIncrement`
- `uuid` → `text` using `crypto.randomUUID()`
- `numeric` → `real`
- `date` → `text` (ISO 8601 format: YYYY-MM-DD)
- `boolean` → `integer` with `{ mode: 'boolean' }`

**Schema Management:**
- Drizzle-kit for migrations (requires manual `drizzle.config.ts` updates)
- Bootstrap script creates tables on first run if missing
- Foreign key constraints enabled via PRAGMA

## Business Logic

**Order Status Workflow:**
- `draft` → `confirmed` → `fulfilled` → `cancelled`
- Cancelled can occur from any state
- Status transitions handled via API updates

**Inventory Calculations (Two-Tier Model):**
- **Working Stock** = Opening Balance + Expected Receipts
- **Usable Stock** = Working Stock + Safety Stock
- **Post-Pending Stock** = Usable Stock - Pending Orders
- **Shortfall to Fulfill** = max(0, Pending Orders - Usable Stock)
- **Shortfall to Restore Safety** = max(0, Safety Stock - Post-Pending Stock)
- **Total Required to Order** = Shortfall to Fulfill + Shortfall to Restore Safety
- Pending orders count only draft/confirmed orders within selected month
- Safety stock status: critical (≤0 post-pending), low (<50% safety), good (≥50%)

**Shipment Tracking:**
- Supports partial shipments per order line item
- Tracks lot numbers, shipment dates, and quantities
- Records rejections in three categories: blowhole, handles, other
- Calculates total shipped and remaining quantities

## Build and Deployment

**Development Mode:**
- `npm run dev` starts server on port 5001 with hot reload
- Vite dev server proxies `/api/*` requests to Express backend
- Client accessible at `http://localhost:5001`

**Production Build:**
- `npm run build` compiles both client (Vite) and server (esbuild)
- Client assets built to `dist/public`
- Server bundle built to `dist/index.js` as ES module
- `npm start` runs production server serving static files and API

**Deployment Target:**
- AWS LightSail with Nginx reverse proxy
- Database path configurable via `DATABASE_URL` environment variable
- Trust proxy setting enabled in production for proper IP handling
- Session cookies set to secure in production mode

# External Dependencies

## Third-Party Libraries

**Frontend:**
- @tanstack/react-query: Server state management and caching
- wouter: Lightweight client-side routing
- @radix-ui/*: Unstyled UI primitives (dialogs, dropdowns, tooltips, etc.)
- react-hook-form: Form state management
- @hookform/resolvers: Zod integration for form validation
- date-fns: Date formatting and manipulation
- lucide-react: Icon library
- tailwindcss: Utility-first CSS framework
- class-variance-authority: Variant styling utility
- clsx + tailwind-merge: Class name utilities

**Backend:**
- express: Web server framework
- express-session: Session management middleware
- bcryptjs: Password hashing
- better-sqlite3: SQLite database driver
- drizzle-orm: SQL query builder and ORM
- drizzle-kit: Database migration tool
- zod: Schema validation
- dotenv: Environment variable management
- cors: CORS middleware

**Build Tools:**
- vite: Frontend build tool and dev server
- esbuild: Server-side bundler
- typescript: Type checking
- tsx: TypeScript execution for development

## Environment Variables

Required variables in `.env`:
- `ADMIN_USERNAME`: Admin login username
- `ADMIN_PASSWORD`: Admin login password (hashed with bcrypt on startup)
- `SESSION_SECRET`: Secret key for session signing
- `DATABASE_URL`: Path to SQLite database file (optional, defaults to `server/data/onyx.db`)
- `NODE_ENV`: Environment mode (`development` or `production`)

## Database

**SQLite Configuration:**
- No external database service required
- Local file-based storage
- Configured with WAL mode for concurrent reads/writes
- 5-second busy timeout for write conflicts
- Foreign key constraints enforced

## External Services

**None currently integrated.** The system is designed to run completely standalone without external API dependencies or cloud services beyond basic hosting infrastructure (AWS LightSail).