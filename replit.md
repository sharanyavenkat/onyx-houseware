# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. The system manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. It's optimized for a small manufacturing operation with shared admin user accounts and read-only viewer accounts.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System**
- React with TypeScript for type safety across the application
- Vite as the build tool for fast development iteration and optimized production builds
- ES modules throughout for modern JavaScript standards

**Routing**
- Wouter library for client-side routing
- Chosen over React Router for minimal bundle size and simpler API
- Suitable for straightforward navigation patterns without nested routes

**State Management**
- TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates
- No global client state management library (Redux, Zustand, etc.)
- Form state managed locally with React Hook Form
- Session state handled server-side

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives
- "New York" style variant configuration
- Accessible, unstyled components customized with TailwindCSS
- Consistent theming through CSS variables

**Styling Approach**
- TailwindCSS utility-first styling with custom design tokens
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data interfaces
- Consistent spacing scale (2, 4, 6, 8, 12 Tailwind units)
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Inter font family from Google Fonts for UI text
- Monospace fonts for numerical data in tables

**Design Philosophy**
- Utility-focused with data density prioritized over aesthetics
- Interface emphasizes clarity, learnability, and efficiency for daily administrative tasks
- 12-column responsive grid system
- Mobile-responsive with progressive disclosure on smaller screens

## Backend Architecture

**Runtime & Framework**
- Node.js with Express.js framework
- ES module mode throughout the application
- TypeScript for type safety

**Project Structure**
- Monorepo with three main directories:
  - `client/` - React frontend application
  - `server/` - Express backend API
  - `shared/` - Shared TypeScript types and schemas
- Shared type definitions ensure type safety across full stack

**API Design**
- RESTful API with all endpoints prefixed with `/api/*`
- All API routes require authentication except login/logout endpoints
- JSON request/response format
- HTTP-only cookies for session management

**Authentication & Authorization**
- Session-based authentication using `express-session` with httpOnly cookies
- Two user roles: admin (full access) and viewer (read-only)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs (12 salt rounds)
- Session cookies configured for production HTTPS with `secure` flag
- Trust proxy setting enabled for deployment behind Nginx reverse proxy

**Build Process**
- Frontend: Vite builds React app to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Single production artifact in `dist/` directory
- Environment-aware configuration for development vs production paths

## Database Architecture

**Database System**
- SQLite with better-sqlite3 driver (migrated from PostgreSQL/Neon)
- Drizzle ORM for type-safe database operations
- Environment-aware database paths:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` (AWS LightSail)

**Performance Optimizations**
- WAL (Write-Ahead Logging) journal mode for better concurrency
- 5-second busy timeout for handling concurrent writes
- Foreign key constraints enabled

**Schema Management**
- Schema defined in `shared/schema.ts` using Drizzle's SQLite table definitions
- Bootstrap function (`server/db/bootstrap.ts`) handles table creation and migrations
- Safe ALTER TABLE operations through `addColumnIfNotExists` helper
- Development workflow: `npm run db:push` for quick schema sync
- Production workflow: Bootstrap runs automatically on startup

**Data Types**
- Integer with autoIncrement for primary keys
- Text fields for UUIDs (using `crypto.randomUUID()`)
- Real for decimal numbers (prices, quantities)
- Text in ISO 8601 format for dates
- Integer with boolean mode for boolean flags

**Core Tables**
- `users` - Admin and viewer accounts with role-based access
- `items` - Product catalog with SKU, pricing, safety stock levels
- `customers` - Customer contact information
- `orders` - Purchase orders with status tracking
- `order_items` - Line items for each order
- `batches` - Production batch tracking with quality status
- `shipments` - Shipment tracking linked to order items and batches
- `invoices` - Invoice generation with shipment references
- `accessories` - Accessory inventory management
- `indents` - Monthly inventory planning and stock projections

**Inventory Model**
- Two-tier safety stock system (current vs desired)
- Batch-driven current stock as single source of truth
- Working stock calculation: current stock + expected receipts
- Usable stock: working stock + current safety stock
- Safety stock breach detection for reorder alerts

# External Dependencies

## Third-Party Services

**Cloud Infrastructure**
- AWS LightSail for production deployment
- Nginx reverse proxy for HTTPS termination and routing

**CDN & Fonts**
- Google Fonts CDN for Inter font family
- Preconnect optimization for fonts.googleapis.com and fonts.gstatic.com

## NPM Dependencies

**Frontend Core**
- React 18+ for UI rendering
- TypeScript for type safety
- Vite for development server and build tooling
- Wouter for lightweight routing

**Backend Core**
- Express.js for HTTP server
- express-session for session management
- better-sqlite3 for SQLite database access
- Drizzle ORM for database operations
- bcryptjs for password hashing
- dotenv for environment variable management

**UI Components & Styling**
- @radix-ui/* primitives for accessible components
- TailwindCSS for utility-first styling
- class-variance-authority for component variants
- lucide-react for icon system

**Data Fetching & Forms**
- @tanstack/react-query for server state management
- react-hook-form for form state management
- @hookform/resolvers with zod for form validation
- drizzle-zod for schema validation

**Build Tools**
- esbuild for server code bundling
- tsx for TypeScript execution in development
- Vite plugins for React and path resolution

**Development**
- @types/* packages for TypeScript definitions
- React Query DevTools for debugging
- No test framework currently configured

## Environment Variables

Required environment variables (stored in `.env`):
- `DATABASE_URL` - Path to SQLite database file
- `ADMIN_USERNAME` - Admin account username
- `ADMIN_PASSWORD` - Admin account password
- `VIEWER_USERNAME` - Viewer account username (optional)
- `VIEWER_PASSWORD` - Viewer account password (optional)
- `SESSION_SECRET` - Secret key for session encryption
- `NODE_ENV` - Environment mode (development/production)