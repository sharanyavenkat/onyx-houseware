# Overview

This is an Onyx Houseware Order Management System - a mini CRM web application designed for a cookware manufacturing company. The system manages orders, items (product catalog), customers, and monthly inventory planning (indent). It provides functionality for tracking purchase orders, managing product specifications with safety stock levels, customer relationship management, and automated inventory calculations based on pending orders and expected receipts. The application includes shipment tracking with rejection monitoring to manage order fulfillment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System:**
- React with TypeScript for type safety
- Vite as the build tool providing fast development server with hot module replacement
- Wouter for lightweight client-side routing (simpler alternative to React Router)

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives for accessible, unstyled components
- TailwindCSS for utility-first styling with custom design tokens
- Material Design principles adapted for enterprise data-heavy applications
- Custom CSS variables for theme management supporting dark/light modes
- Inter font family from Google Fonts for clean typography
- Monospace fonts for numerical data in tables to improve readability

**State Management Strategy:**
- TanStack Query (React Query) manages all server state, cache invalidation, and data fetching
- No global client state management - form state handled locally with React hooks
- Optimistic updates for immediate UI feedback
- Automatic background refetching and cache management

**Design Philosophy:**
- Enterprise-focused interface prioritizing data density and clarity over aesthetics
- Consistent spacing system using Tailwind units (2, 4, 6, 8, 12)
- Semantic status colors: green (fulfilled), amber (draft/pending), red (cancelled), cyan (info)
- 12-column responsive grid system for flexible layouts
- Utility-focused approach favoring composition over custom CSS

## Backend Architecture

**Runtime & Framework:**
- Node.js runtime with Express.js web framework
- TypeScript with ES modules for type-safe server code
- Monorepo structure with shared type definitions between client and server in `/shared` directory

**Database Layer:**
- SQLite database using better-sqlite3 driver for simplicity and portability
- Drizzle ORM for type-safe database queries and schema management
- Environment-aware database paths (development: `server/data/onyx.db`, production: `/var/app/data/onyx.db`)
- SQLite performance optimizations: WAL journaling mode, busy timeout of 5000ms, foreign keys enabled
- Bootstrap system in `server/db/bootstrap.ts` for automatic schema initialization and safe migrations

**Schema Design:**
- Users table with UUID-based IDs for admin authentication
- Items table for product catalog with SKU, pricing, safety stock, and active/inactive status
- Customers table with company and contact information
- Orders table with PO numbers, dates, status workflow (draft → confirmed → fulfilled/cancelled)
- OrderItems junction table linking orders to items with quantities
- Indents table for monthly inventory planning with opening balance and expected receipts
- Shipments table tracking fulfillment with lot numbers, quantities, dates, and rejection counts (blowhole, handles, other)

**Authentication & Session Management:**
- Single shared admin account (no signup functionality)
- Express-session with httpOnly cookies for session management
- Bcrypt password hashing with 12 salt rounds
- Admin credentials loaded from environment variables on first boot
- Session-based authentication middleware protecting all `/api/*` routes
- Multiple concurrent sessions supported for the same admin user

**API Design:**
- RESTful API endpoints under `/api` namespace
- Zod schema validation for all POST/PUT/PATCH requests (returns 422 on validation errors)
- Consistent error handling with appropriate HTTP status codes
- JSON request/response format

**Business Logic:**
- Shared inventory calculation utilities in `/shared/inventory.ts` for two-tier inventory model:
  - Working Stock = Opening Balance + Expected Receipts
  - Safety Stock = Buffer inventory maintained separately
  - Usable Stock = Working Stock + Safety Stock
  - Automatic calculation of required order quantities based on pending orders and safety stock levels
- Status workflow enforcement for orders
- Automatic aggregation of shipment quantities and rejections per order item

## External Dependencies

**Build & Development Tools:**
- Vite for frontend bundling and development server
- esbuild for server-side bundling in production
- TypeScript compiler for type checking
- Drizzle Kit for database schema migrations

**UI Component Libraries:**
- Radix UI primitives: Dialog, Dropdown, Select, Toast, Tooltip, and other accessible components
- class-variance-authority for component variant styling
- clsx and tailwind-merge for conditional className composition
- cmdk for command palette functionality
- date-fns for date formatting and manipulation

**Backend Infrastructure:**
- Express.js web server framework
- express-session for session management
- bcryptjs for password hashing
- better-sqlite3 for SQLite database operations
- Drizzle ORM for database abstraction
- cors middleware for cross-origin requests
- dotenv for environment variable management

**Validation & Type Safety:**
- Zod for runtime schema validation
- drizzle-zod for generating Zod schemas from Drizzle tables
- TypeScript for compile-time type checking across client and server

**Database:**
- SQLite as the database engine (file-based, no external database server required)
- Database file location configurable via `DATABASE_URL` environment variable
- Automatic database initialization on startup if tables don't exist

**Deployment:**
- Designed for AWS LightSail deployment (documented in DEPLOYMENT.md)
- Nginx reverse proxy support in production mode
- Session cookies configured for secure transmission in production
- Separate build processes for client (Vite) and server (esbuild)