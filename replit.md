# Overview

Onyx Houseware Order Management System is a mini-CRM web application for a cookware manufacturing company. It manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. The application is optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System:**
- React with TypeScript using Vite for fast development and optimized production builds
- ES module mode throughout the application

**Routing:**
- Wouter library for lightweight client-side routing
- Chosen over React Router for minimal bundle size and simpler API
- Routes: Dashboard (/), Orders (/orders, /orders/:id), Batches (/batches), Indent (/indent), Items (/items), Customers (/customers)

**State Management:**
- TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates
- No global client state management - form state is managed locally with React Hook Form
- Session-based authentication state managed through React Query's cache invalidation

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives ("New York" style variant)
- TailwindCSS with custom design tokens defined in CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces

**Design System:**
- Utility-focused design prioritizing data density over aesthetics
- Consistent spacing scale (2, 4, 6, 8, 12 Tailwind units)
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Inter font family for UI, monospace fonts for numerical data in tables
- 12-column responsive grid layout

## Backend Architecture

**Runtime & Framework:**
- Node.js with Express.js in ES module mode
- TypeScript for type safety across the full stack
- Shared type definitions between client and server in `/shared` directory

**Monorepo Structure:**
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schemas (Zod + Drizzle)

**API Design:**
- RESTful API with all endpoints prefixed with `/api/*`
- All routes require authentication except `/api/auth/login` and `/api/auth/logout`
- JSON request/response format
- HTTP-only session cookies for authentication

**Authentication & Authorization:**
- Session-based authentication using `express-session`
- Single shared admin account (no user registration)
- Admin credentials stored in environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- Passwords hashed with bcryptjs (12 salt rounds)
- Sessions stored in memory (suitable for single-user deployment)
- In production, trusts proxy headers when behind Nginx

**Database Layer:**
- SQLite with better-sqlite3 driver
- Drizzle ORM for type-safe database queries
- Environment-aware database path via `DATABASE_URL`:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` (AWS LightSail)
- WAL mode enabled for better concurrency
- Foreign keys enabled
- Bootstrap script (`server/db/bootstrap.ts`) creates tables on startup using "IF NOT EXISTS" pattern

**Data Model:**
- Users (admin authentication)
- Items (products with SKU, price, safety stock levels)
- Customers (company information and contacts)
- Orders (PO numbers, status, dates)
- Order Items (line items with quantities)
- Batches (production batches with quality status)
- Indents (monthly procurement planning with expected receipts)
- Shipments (delivery tracking with rejection reasons)

**Inventory System:**
- Two-tier inventory model: Working Stock + Safety Stock
- Shared calculation utilities in `/shared/inventory.ts`
- Working Stock = Opening Balance + Expected Receipts
- Usable Stock = Working Stock + Current Safety Stock
- Tracks pending orders, shortfalls, and procurement requirements

## External Dependencies

**Build & Development Tools:**
- Vite - Frontend build tool and dev server
- esbuild - Backend bundler for production
- TypeScript - Type checking across full stack
- TSX - TypeScript execution for development

**UI Libraries:**
- Radix UI - Unstyled, accessible component primitives (accordion, dialog, dropdown, select, etc.)
- TailwindCSS - Utility-first CSS framework
- Lucide React - Icon library
- class-variance-authority - Component variant management
- clsx + tailwind-merge - Conditional CSS class utilities

**Backend Dependencies:**
- Express.js - Web server framework
- express-session - Session management middleware
- bcryptjs - Password hashing
- better-sqlite3 - SQLite database driver
- Drizzle ORM - Type-safe SQL query builder
- drizzle-zod - Zod schema generation from Drizzle schemas
- CORS - Cross-origin resource sharing (for development)
- dotenv - Environment variable management

**Form & Validation:**
- React Hook Form - Form state management
- Zod - Schema validation
- @hookform/resolvers - React Hook Form + Zod integration

**Date Handling:**
- date-fns - Date formatting and manipulation
- Dates stored as ISO 8601 strings (YYYY-MM-DD) in SQLite

**Deployment Target:**
- AWS LightSail container service
- Nginx reverse proxy in production
- Persistent volume mounted at `/var/app/data` for SQLite database
- Environment variables managed through LightSail console