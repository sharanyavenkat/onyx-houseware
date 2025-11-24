# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. It manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. The system is optimized for a small manufacturing operation with a single shared admin user account.

The application handles:
- Order management with line items and customer tracking
- Inventory management with batch tracking and quality control
- Production planning through monthly indent sheets
- Shipment tracking with rejection/defect monitoring
- Customer and product catalog management

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Monorepo Structure

**Architecture Pattern:** Full-stack TypeScript monorepo with three main directories:
- `client/` - React frontend (Vite build)
- `server/` - Express.js backend (Node.js/TypeScript)
- `shared/` - Shared type definitions and schemas

**Rationale:** This structure ensures type safety across the entire stack by sharing TypeScript types between frontend and backend. The shared schema definitions eliminate type mismatches and reduce duplication.

## Frontend Architecture

**Framework:** React 18 with TypeScript, built using Vite for fast development and optimized production builds.

**Routing:** Wouter library chosen over React Router for its minimal bundle size (~1.2KB) and simpler API, suitable for the application's straightforward navigation needs.

**State Management:**
- **Server State:** TanStack Query (React Query) v5 handles all server state with automatic caching, background refetching, and optimistic updates
- **Client State:** No global state management library - form state managed locally with React Hook Form, UI state managed with React's built-in useState/useReducer
- **Rationale:** TanStack Query eliminates the need for Redux/Zustand for server state, reducing complexity while providing better developer experience

**UI Component System:**
- **Base:** Shadcn/ui component library (built on Radix UI primitives)
- **Style Variant:** "New York" configuration (configured in `components.json`)
- **Styling:** TailwindCSS with CSS variables for theming
- **Rationale:** Shadcn provides accessible, unstyled components that can be customized with Tailwind, avoiding the lock-in of component libraries like Material-UI while maintaining accessibility

**Design System:**
- Material Design principles adapted for enterprise data-heavy interfaces
- Utility-focused design prioritizing data density over aesthetics
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Dark/light mode support through CSS class-based theming
- Inter font family for UI, monospace fonts for numerical data in tables

## Backend Architecture

**Runtime & Framework:** Node.js with Express.js, running in ES module mode (type: "module" in package.json).

**API Design:** RESTful API with all endpoints prefixed with `/api/*`. Authentication required for all endpoints except `/api/auth/login` and `/api/auth/logout`.

**Authentication:**
- **Method:** Session-based authentication using `express-session` with httpOnly cookies
- **User Model:** Single shared admin account (no user registration system)
- **Credential Storage:** Admin username/password stored in environment variables, hashed with bcryptjs (12 salt rounds)
- **Rationale:** Session-based auth chosen over JWT for simplicity in a single-user system. HttpOnly cookies prevent XSS attacks. No need for complex user management with only one admin account.

**Production Configuration:**
- Trust proxy enabled in production for compatibility with reverse proxy (Nginx on AWS Lightsail)
- Secure cookies enforced in production (HTTPS required)
- Cookie settings: sameSite "lax", maxAge 24 hours

## Database Architecture

**Database:** SQLite with better-sqlite3 driver (migrated from PostgreSQL/Neon).

**ORM:** Drizzle ORM chosen for its:
- Type-safe SQL query builder with excellent TypeScript inference
- Lightweight runtime with no heavy abstractions
- SQL-like API that's closer to raw SQL than Prisma
- Support for SQLite and potential future migration to PostgreSQL

**Database Configuration:**
- **Development:** `server/data/onyx.db` (relative path)
- **Production:** `/var/app/data/onyx.db` (absolute path for AWS Lightsail persistence)
- **PRAGMAs:** WAL mode for better concurrency, busy_timeout 5000ms, foreign_keys enabled

**Schema Migration Strategy:**
- Development: `npm run db:push` for rapid schema iteration
- Production: Bootstrap function (`server/db/bootstrap.ts`) with safe ALTER TABLE operations
- All schema changes use `addColumnIfNotExists()` helper to prevent duplicate column errors
- **Rationale:** This two-tier approach allows fast development iteration while ensuring safe production deployments without migration files

**Schema Highlights:**
- Auto-incrementing integer IDs for all entities except users (UUID for users)
- Text-based date storage in ISO 8601 format (SQLite limitation)
- Boolean fields stored as integers with `{ mode: 'boolean' }` for type safety
- Numeric fields use `real` type (SQLite's floating point)

## Data Model

**Core Entities:**
1. **Users** - Admin accounts (single user in practice)
2. **Items** - Product catalog with SKU, pricing, safety stock levels
3. **Customers** - Customer contact information
4. **Orders** - Purchase orders with status tracking
5. **OrderItems** - Line items within orders
6. **Batches** - Production batches with quality status and on-hand quantities
7. **Shipments** - Delivery tracking with rejection/defect counts
8. **Indents** - Monthly production planning sheets with expected receipts and safety stock

**Inventory Model:**
- **Current Stock:** Real-time on-hand inventory calculated from batch quantities (single source of truth)
- **Working Stock:** Current Stock + Expected Receipts (monthly indent data)
- **Safety Stock:** Two-tier system - current available buffer and desired target level
- **Usable Stock:** Working Stock + Current Safety Stock (total available for orders)
- **Rationale:** Simplified from original three-tier model. Batches provide real-time stock data, removing need for separate opening balance tracking.

## Build & Deployment

**Development:**
- `npm run dev` - Runs Express server with Vite middleware for HMR
- TypeScript compiled on-the-fly with tsx
- Hot module replacement for React components

**Production Build:**
- `npm run build` - Two-step process:
  1. Vite builds React app to `dist/public/`
  2. esbuild bundles Express server to `dist/index.js`
- `npm start` - Runs bundled server in production mode

**Deployment Target:** AWS Lightsail with Nginx reverse proxy.

**Environment Configuration:**
- `.env` file in project root
- Required variables: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`
- Environment-aware database path selection (development vs production)

# External Dependencies

## Core Framework Dependencies

- **Express.js** (^4.x) - Web server framework
- **React** (^18.x) - UI library
- **TypeScript** (^5.x) - Type safety across entire stack
- **Vite** (^5.x) - Frontend build tool and dev server

## Database & ORM

- **better-sqlite3** (^12.4.1) - Synchronous SQLite driver for Node.js
- **Drizzle ORM** (drizzle-orm, drizzle-kit) - Type-safe ORM layer
- **dotenv** - Environment variable management

## Authentication & Security

- **express-session** - Session management middleware
- **bcryptjs** (^3.0.2) - Password hashing (12 salt rounds)
- **cors** (^2.8.5) - Cross-origin resource sharing

## UI Component Libraries

- **Radix UI** - Headless UI primitives (20+ component packages)
  - Dialog, Select, Dropdown, Toast, Accordion, etc.
  - Chosen for accessibility compliance and unstyled flexibility
- **Shadcn/ui** - Pre-composed components built on Radix
- **TailwindCSS** (^3.x) - Utility-first CSS framework
- **class-variance-authority** (^0.7.1) - Component variant management
- **Lucide React** - Icon library

## State & Data Management

- **TanStack Query** (^5.60.5) - Server state management
  - Automatic caching and background refetching
  - Optimistic updates for better UX
  - DevTools for debugging
- **React Hook Form** (^7.x) - Form state management
- **Zod** (^3.x) - Runtime schema validation
- **@hookform/resolvers** (^3.10.0) - Zod integration with React Hook Form

## Utilities

- **date-fns** (^3.6.0) - Date formatting and manipulation
- **clsx** + **tailwind-merge** - Conditional CSS class merging
- **nanoid** - Unique ID generation

## Build Tools

- **esbuild** - Fast bundler for server code
- **tsx** - TypeScript execution for development
- **postcss** + **autoprefixer** - CSS processing

## Font Loading

- **Google Fonts CDN** - Inter font family (weights 300-700)
  - Loaded via `<link>` in `client/index.html`
  - No npm dependency, reduces bundle size