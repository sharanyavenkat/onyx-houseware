# Overview

This is an Onyx Houseware order management system - a mini CRM web application designed for a cookware manufacturing company. The system manages orders, items, customers, and inventory planning (indent) with shipment tracking capabilities.

The application provides:
- **Product catalog management**: Items with SKUs, pricing, size specifications, and safety stock levels
- **Customer relationship management**: Company details and contact information
- **Order management**: Purchase order tracking with status workflow (draft → confirmed → fulfilled/cancelled)
- **Monthly inventory planning (indent)**: Automatic calculation of required order quantities based on opening balance, expected receipts, pending orders, and safety stock
- **Shipment tracking**: Order fulfillment tracking with rejection categories (blowhole, handles, other)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework and Build Tools:**
- React with TypeScript for type-safe component development
- Vite as build tool and development server (port 5173 in dev, served via Express in production)
- Wouter for lightweight client-side routing (no React Router)

**UI and Styling:**
- Shadcn/ui component library built on Radix UI primitives
- TailwindCSS with custom design system and CSS variables for theming
- Material Design principles adapted for enterprise data-heavy applications
- Dark/light mode support via CSS class toggling
- Inter font family from Google Fonts
- Utility-focused design prioritizing data density and clarity over aesthetics
- Consistent spacing system using Tailwind units (2, 4, 6, 8, 12)
- Status color coding: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Monospace fonts for numerical data in tables

**State Management:**
- TanStack Query (React Query) for all server state management
- No global client state - form state managed locally with React hooks
- Optimistic updates and automatic cache invalidation
- Custom `queryClient` with infinite stale time and disabled refetch on window focus

**Design Philosophy:**
- Enterprise-focused with data density prioritized
- 12-column responsive grid system
- Hover and active states using elevation utilities (`hover-elevate`, `active-elevate-2`)
- Consistent form validation with error display
- Auto-save functionality in Indent page using debounced mutations

## Backend Architecture

**Runtime and Framework:**
- Node.js with Express.js server (port 3000 in dev, configurable in production)
- TypeScript with ES modules throughout
- Single monorepo structure with shared types between client and server (`@shared` path alias)

**Database:**
- SQLite via `better-sqlite3` for local and production deployments
- Drizzle ORM for type-safe database operations
- Database file location controlled by `DATABASE_URL` environment variable:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` (AWS LightSail)
- WAL (Write-Ahead Logging) journal mode for better concurrency
- Foreign keys enabled, 5-second busy timeout
- Schema bootstrap on startup using `server/db/bootstrap.ts`
- Schema changes handled via `addColumnIfNotExists` helper for safe migrations

**Database Schema:**
- **users**: Admin authentication (UUID-based IDs, bcrypt-hashed passwords)
- **items**: Product catalog with SKU, pricing, size specs, safety stock, active status
- **customers**: Company information and contact details
- **orders**: Purchase orders with status workflow, dates, and notes
- **order_items**: Line items linking orders to items with quantities
- **indents**: Monthly inventory planning (opening balance, expected receipts per item)
- **shipments**: Fulfillment tracking with lot numbers, quantities, dates, and rejection categories

**Authentication:**
- Session-based authentication using `express-session`
- Single shared admin account (no signup functionality)
- Admin credentials from environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- Password hashing with bcrypt (12 salt rounds)
- Auto-initialization of admin user on first startup if not exists
- Session cookies: httpOnly, secure in production, 24-hour maxAge
- All `/api/*` routes protected by `requireAuth` middleware
- Trust proxy enabled in production for reverse proxy compatibility (Nginx)

**API Design:**
- RESTful endpoints following convention: `/api/{resource}` and `/api/{resource}/:id`
- Zod schema validation on all POST/PUT payloads (422 on validation failure)
- Consistent error handling with status codes and messages
- Special endpoints:
  - `/api/auth/login` and `/api/auth/logout` (public)
  - `/api/auth/me` for session verification
  - `/api/shipments/order-item/:orderItemId` for shipment tracking
  - `/api/indents/:month` for monthly indent data
  - `/api/order-items` for all order line items

**Business Logic:**
- Inventory calculations in `shared/inventory.ts`:
  - Working Stock = Opening Balance + Expected Receipts
  - Usable Stock = Working Stock + Safety Stock
  - Shortfall calculations for fulfilling orders and restoring safety stock
  - Safety stock status indicators (critical/low/good)
- Auto-calculation of required order quantities in Indent page
- Pending order aggregation from draft and confirmed orders only
- Date utilities in `client/src/lib/dateUtils.ts` for consistent date formatting (DD-MM-YYYY display, YYYY-MM-DD storage)

## External Dependencies

**Core Framework Dependencies:**
- **Express.js**: Web server framework
- **React**: UI library (v18+)
- **TypeScript**: Type safety across entire stack
- **Vite**: Build tool and dev server
- **Drizzle ORM**: Type-safe database queries
- **better-sqlite3**: SQLite database driver

**Authentication:**
- **express-session**: Session management
- **bcryptjs**: Password hashing

**Frontend Libraries:**
- **TanStack Query (React Query)**: Server state management
- **Wouter**: Client-side routing
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **date-fns**: Date manipulation

**UI Components:**
- **Radix UI**: Unstyled accessible components (@radix-ui/react-*)
- **Shadcn/ui**: Pre-built component implementations
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **tailwind-merge & clsx**: Utility class merging

**Development Tools:**
- **tsx**: TypeScript execution for development server
- **esbuild**: Production server bundling
- **dotenv**: Environment variable management
- **drizzle-kit**: Database schema management

**Third-Party Services:**
- Google Fonts CDN: Inter font family
- No external APIs or cloud services (fully self-contained)

**Deployment Targets:**
- Local development (Node.js 20.x+, npm 10.x+)
- AWS LightSail with Nginx reverse proxy
- SQLite database persisted on filesystem (no external database service)