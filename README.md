# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. The system manages the complete order lifecycle from customer inquiries to fulfillment, including product catalog management, customer relationships, order tracking with purchase orders, monthly inventory planning (indent), and shipment tracking with rejection monitoring.

The application serves as a lightweight alternative to enterprise systems like Zoho Inventory, optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework:** React with TypeScript, using Vite as the build tool for fast development and optimized production builds.

**Routing:** Wouter library for lightweight client-side routing. This was chosen over React Router for its minimal bundle size and simpler API, suitable for the application's straightforward navigation needs.

**State Management:** TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates. No global client state management is used—form state is managed locally with React hooks. This eliminates complexity while providing excellent data synchronization.

**UI Components:** Shadcn/ui component library built on Radix UI primitives, providing accessible, unstyled components that are customized with TailwindCSS. The "New York" style variant is used (configured in components.json).

**Styling System:**
- TailwindCSS with custom design tokens defined in CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Consistent spacing scale (2, 4, 6, 8, 12 Tailwind units)
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Inter font family from Google Fonts
- Monospace fonts for numerical data in tables

**Design Philosophy:** Utility-focused with data density prioritized over aesthetics. The interface emphasizes clarity, learnability, and efficiency for daily administrative tasks. 12-column responsive grid system for flexible layouts.

## Backend Architecture

**Runtime:** Node.js with Express.js framework running in ES module mode.

**Language:** TypeScript with shared type definitions between client and server (located in `/shared` directory), ensuring type safety across the full stack.

**Monorepo Structure:** Single repository with three main directories:
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schemas

**API Design:** RESTful API with all endpoints prefixed with `/api/*`. All API routes require authentication except login/logout endpoints.

**Authentication & Authorization:**
- Session-based authentication using `express-session` with httpOnly cookies
- Single shared admin account (no user registration)
- Admin credentials stored in environment variables and hashed with bcryptjs (12 salt rounds)
- On application startup, admin user is auto-created if not present
- Multiple concurrent sessions are allowed for the shared account
- Trust proxy enabled in production for reverse proxy compatibility (Nginx)

**Session Management:**
- 24-hour session duration
- Secure cookies in production (HTTPS only)
- Session storage handled by express-session default (MemoryStore for development)

**Validation:** Zod schemas for all API request/response validation, returning 422 status codes on validation failures. Schemas are defined in `shared/schema.ts` and shared between client and server.

## Database Layer

**Database:** SQLite with better-sqlite3 driver for synchronous operations.

**ORM:** Drizzle ORM with type-safe query builder and automatic type inference.

**Schema Management:**
- Schema definitions in `shared/schema.ts` using Drizzle's SQLite table builders
- Bootstrap process in `server/db/bootstrap.ts` creates tables on startup if missing
- Schema migrations via `npm run db:push` using drizzle-kit

**Database Configuration:**
- Development: `server/data/onyx.db`
- Production: Configurable via `DATABASE_URL` environment variable (defaults to `/var/app/data/onyx.db` on AWS LightSail)
- WAL (Write-Ahead Logging) mode enabled for better concurrency
- 5-second busy timeout for handling concurrent access
- Foreign keys enforcement enabled

**Data Model:**
- Users: UUID-based IDs, bcrypt password hashing
- Items: Auto-increment integer IDs, SKU-based product catalog with safety stock levels, active/inactive status
- Customers: Company-based customer records with contact information
- Orders: PO number tracking, status workflow (draft → confirmed → fulfilled/cancelled), date tracking
- Order Items: Line items with quantity and item references
- Indents: Monthly inventory planning with opening balance and expected receipts
- Batches: Production batch tracking with batch_number (SKU+YYMMDD format), quantity management (produced, remaining, rejected), quality status (Good/Acceptable/Rejected), received_date, is_depleted flag. Canonical invariant: quantity_remaining = quantity_produced - quantity_shipped - quantity_rejected
- Shipments: Batch-based shipment tracking (renamed from lot_number to batch_number) with rejection counts (blowhole, handles, other)

**Type Conversions from PostgreSQL:**
- `serial` → `integer` with autoIncrement
- `uuid` → `text` using crypto.randomUUID()
- `numeric` → `real` for decimal values
- `date` → `text` in ISO 8601 format
- `boolean` → `integer` with mode: 'boolean'

## Business Logic

**Inventory Planning (Indent):**
- Two-tier model: Working Stock (from batches) + Safety Stock (buffer) = Total Usable Stock
- Working Stock = Quantity Produced - Shipped - Rejected  
- Pending Orders = Ordered - Shipped + Rejected (rejected items need replacement)
- Formula: `required_to_order = max(0, (pending_orders + safety_stock) - (opening_balance + expected_receipts))`
- Auto-save with debouncing for indent updates

**Order Management:**
- Status workflow enforcement: draft → confirmed → fulfilled or cancelled
- Line items support with item quantity tracking
- Purchase order number (PO) uniqueness validation
- Date tracking for order date and fulfillment date

**Pending Orders Calculation (November 2025 Architecture):**
- **Formula:** `pending = ordered - shipped + rejected`
- **Rationale:** Rejected pieces need replacement, so they count against fulfillment
- **Single Source of Truth:** Backend method `getPendingOrdersByItem()` used across all pages (Dashboard, Indent, Order Details)
- **Implementation:** Aggregates rejection totals (blowholes + handles + other) per order item from shipments table
- **Consistency:** All UI components fetch from `/api/orders/pending-by-item` endpoint instead of local calculations

**Shipment & Rejection Tracking (November 2025 Architecture):**
- **Single Source of Truth:** Shipments table captures all rejection data at inspection time
- **Batch-based shipments:** Each shipment links to order item with batch_number (required field, renamed from lot_number)
- **Rejection Categories:** blowholes, handles, other defects tracked per shipment
- **Read-only Aggregation:** `batch.quantity_rejected` is calculated sum of rejections, not directly editable
- **Batch Updates:** Automated triggers update `batch.quantity_remaining` and `quantity_rejected` when shipments change
- **Canonical Invariant:** `quantity_remaining = quantity_produced - quantity_shipped - quantity_rejected`
- **UI Terminology:** "Batch number" (not "Lot number"), "Available" batches (not "Active"), "Desired Safety Stock" (not "Target")
- **CRUD Operations:** Shipments can be added/edited/deleted per order item with rejection tracking

**Cache Invalidation Strategy (November 2025):**
- **Shipment Mutations** (create/update/delete) invalidate:
  - `/api/shipments/order-item` - Refresh shipment list for specific order item
  - `/api/orders` - Refresh order details
  - `/api/shipments` - Refresh all shipments
  - `/api/batches` - Refresh batch list (quantity_remaining, quantity_rejected updates)
  - `/api/batches/opening-balance` - Refresh opening balance calculations
  - `/api/orders/pending-by-item` - Refresh pending orders on Dashboard and Indent
  - `/api/batches/rejected-by-item` - Refresh rejection totals on Indent page
- **Order Mutations** (create/update/delete) invalidate:
  - `/api/orders` - Refresh order list
  - `/api/order-items` - Refresh order line items
  - `/api/orders/pending-by-item` - Refresh pending orders across all pages
- **Rationale:** Ensures Dashboard, Indent, and Batches pages stay in sync when shipments/orders change. Rejections added to shipments immediately update all dependent views.

## Build & Deployment

**Development:**
- `npm run dev` - Runs server on port 5001 with Vite dev server proxying API requests
- Hot module replacement (HMR) for frontend
- TypeScript type checking with `npm run check`

**Production Build:**
- `npm run build` - Builds frontend with Vite and bundles backend with esbuild
- Frontend output: `dist/public/`
- Backend output: `dist/index.js`
- `npm start` - Runs production server with NODE_ENV=production

**Static File Serving:** In production, Express serves the built frontend from `dist/public`. In development, Vite middleware handles all frontend requests.

**Deployment Target:** AWS LightSail with Nginx reverse proxy. Application expects to run behind a trusted proxy in production.

# External Dependencies

## Core Framework Dependencies
- **Express.js** - Web server framework
- **React** - Frontend UI library
- **Vite** - Frontend build tool and dev server
- **TypeScript** - Type system for both client and server

## Database & ORM
- **better-sqlite3** - SQLite database driver (synchronous)
- **Drizzle ORM** - Type-safe SQL query builder and schema management
- **drizzle-kit** - Schema migration tooling

## Authentication & Security
- **express-session** - Session middleware for authentication
- **bcryptjs** - Password hashing (12 rounds)
- **cors** - CORS middleware (if needed for API)

## Frontend State & Data
- **TanStack Query (React Query)** - Server state management with caching
- **Wouter** - Lightweight client-side routing
- **zod** - Runtime type validation and schema validation
- **drizzle-zod** - Zod schema generation from Drizzle schemas

## UI Component Libraries
- **Radix UI** - Headless accessible component primitives (20+ components including dialog, dropdown, select, toast, etc.)
- **Shadcn/ui** - Pre-styled component collection built on Radix UI
- **TailwindCSS** - Utility-first CSS framework
- **class-variance-authority** - Variant-based styling utilities
- **tailwind-merge** - Tailwind class merging utility
- **clsx** - Conditional className utility

## Form & Validation
- **React Hook Form** - Form state management
- **@hookform/resolvers** - Validation resolver for Zod schemas

## Utilities
- **date-fns** - Date manipulation and formatting
- **nanoid** - Unique ID generation
- **dotenv** - Environment variable loading
- **lucide-react** - Icon library

## Development Tools
- **tsx** - TypeScript execution for development
- **esbuild** - Fast JavaScript bundler for backend
- **autoprefixer** - PostCSS plugin for vendor prefixes

## Fonts
- **Google Fonts (Inter)** - Primary typeface loaded via CDN

## Build Output
- Frontend builds to `dist/public/` directory
- Backend bundles to `dist/index.js` with external package dependencies
- Production server serves static files and API from single Express instance