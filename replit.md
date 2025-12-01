# Overview

Onyx Houseware Order Management System is a mini-CRM web application for a cookware manufacturing company. It manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. The system is optimized for a small manufacturing operation with a single shared admin user account.

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
- Main routes: Dashboard, Orders, Order Details, Indent, Items, Batches, Customers

**State Management:**
- TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates
- No global client state management - form state is local to components
- QueryClient configured for consistent data fetching patterns

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives
- "New York" style variant configured in components.json
- Accessible, unstyled base components customized with TailwindCSS
- Components include: Dialog, Select, Input, Table, Card, Badge, Button, Form controls

**Styling Approach:**
- TailwindCSS with custom design tokens defined in CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Consistent spacing scale: 2, 4, 6, 8, 12 Tailwind units
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Inter font family from Google Fonts for UI, monospace fonts for numerical data in tables
- 12-column responsive grid system

**Design Philosophy:**
- Utility-focused with data density prioritized over aesthetics
- Emphasizes clarity, learnability, and efficiency for daily administrative tasks
- Productivity-focused for data-heavy operations

## Backend Architecture

**Runtime & Framework:**
- Node.js 20.x+ with Express.js framework
- ES module mode enabled throughout
- TypeScript for type safety

**Monorepo Structure:**
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schemas between client and server

**API Design:**
- RESTful API with all endpoints prefixed `/api/*`
- Session-based authentication required for all routes except login/logout
- JSON request/response format

**Authentication & Authorization:**
- Session-based authentication using `express-session` with httpOnly cookies
- Single shared admin account (no user registration system)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs using 12 salt rounds
- Session configured for production with proxy trust and secure cookies

**Database Layer:**
- SQLite database using better-sqlite3 driver
- Drizzle ORM for type-safe database operations
- Environment-aware database paths:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db` (or custom path via DATABASE_URL)
- SQLite pragmas configured: WAL journal mode, busy timeout 5000ms, foreign keys enabled
- Bootstrap system for safe schema migrations using CREATE TABLE IF NOT EXISTS and ALTER TABLE statements

**Data Model:**
- Users table with UUID primary keys (crypto.randomUUID())
- Items (products) with SKU, pricing, and desired safety stock
- Customers with contact information
- Orders with PO numbers, dates, and line items
- Order items (join table linking orders and items with quantities)
- Batches for inventory tracking with quality status (Good/Acceptable/Rejected)
- Indents for monthly inventory planning
- Shipments for order fulfillment tracking with rejection reasons

**Business Logic:**
- Inventory calculation system with two-tier safety stock model
- Working stock = current stock + expected receipts
- Usable stock = working stock + current safety stock
- Shared inventory calculation utilities in `shared/inventory.ts`

**Build & Deployment:**
- Development: `npm run dev` with tsx for hot reload
- Production build: Vite builds frontend to `dist/public/`, esbuild bundles server to `dist/`
- Production start: `npm start` runs `node dist/index.js`
- Database migrations via `npm run db:push` using drizzle-kit

## External Dependencies

**Core Framework Dependencies:**
- Node.js runtime (v20.19.5 in production)
- Express.js - Web server framework
- React 18 - UI library
- TypeScript - Type safety across stack
- Vite - Frontend build tool and dev server
- esbuild - Server bundling for production

**Database & ORM:**
- better-sqlite3 - SQLite database driver
- drizzle-orm - TypeScript ORM with type-safe queries
- drizzle-kit - Schema management and migrations
- @types/better-sqlite3 - TypeScript definitions

**Authentication:**
- express-session - Session management
- bcryptjs - Password hashing

**UI Component Libraries:**
- @radix-ui/* - Headless accessible UI primitives (accordion, dialog, dropdown, select, tooltip, etc.)
- @hookform/resolvers - Form validation integration
- react-hook-form - Form state management
- zod - Schema validation
- drizzle-zod - Zod schema generation from Drizzle schemas

**State Management & Data Fetching:**
- @tanstack/react-query - Server state management and caching
- @tanstack/react-query-devtools - Development tools

**Styling:**
- tailwindcss - Utility-first CSS framework
- postcss & autoprefixer - CSS processing
- class-variance-authority - Component variant management
- clsx & tailwind-merge - Conditional class composition

**Routing:**
- wouter - Lightweight React router

**Utilities:**
- date-fns - Date manipulation and formatting
- nanoid - ID generation
- lucide-react - Icon library
- cmdk - Command palette component

**Development Tools:**
- tsx - TypeScript execution for development
- dotenv - Environment variable management

**Deployment Environment:**
- AWS LightSail (target platform)
- systemd service management
- Nginx reverse proxy (implied from trust proxy configuration)
- Production database path: configurable via DATABASE_URL environment variable

**Environment Variables Required:**
- ADMIN_USERNAME - Admin account username
- ADMIN_PASSWORD - Admin account password
- SESSION_SECRET - Session encryption key
- DATABASE_URL - SQLite database file path
- NODE_ENV - Environment mode (development/production)