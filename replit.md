# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. The system manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. It's optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build Tool**
- React with TypeScript using Vite for fast development and optimized production builds
- ES module mode for modern JavaScript features
- Monorepo structure with `client/`, `server/`, and `shared/` directories

**Routing**
- Wouter library for lightweight client-side routing (chosen over React Router for minimal bundle size)
- Straightforward navigation suitable for the application's simple structure

**State Management**
- TanStack Query (React Query) for all server state management
- Automatic caching, background refetching, and optimistic updates
- No global client state management - form state handled locally with React Hook Form
- Query invalidation pattern for data synchronization after mutations

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives
- "New York" style variant configured in `components.json`
- Accessible, unstyled components customized with TailwindCSS
- Component aliases configured for clean imports (`@/components`, `@/lib/utils`)

**Styling**
- TailwindCSS with custom design tokens defined as CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Consistent spacing scale (2, 4, 6, 8, 12 Tailwind units)
- Status-based color system:
  - Green: fulfilled orders
  - Amber: draft/pending
  - Red: cancelled/destructive
  - Cyan: info
- Typography: Inter font family from Google Fonts, monospace for numerical data
- Custom utility classes for elevation (`hover-elevate`, `active-elevate-2`)

**Design Philosophy**
- Utility-focused with data density prioritized over aesthetics
- Emphasis on clarity, learnability, and efficiency for daily administrative tasks
- 12-column responsive grid system

## Backend Architecture

**Runtime & Framework**
- Node.js with Express.js in ES module mode
- TypeScript for type safety across the full stack
- Shared type definitions in `/shared` directory for client-server type consistency

**API Design**
- RESTful API with all endpoints prefixed with `/api/*`
- Session-based authentication required for all endpoints except login/logout
- JSON request/response format
- Credential inclusion required for cross-origin requests

**Authentication & Session Management**
- Session-based authentication using `express-session`
- HttpOnly cookies for security
- Single shared admin account (no user registration system)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs (12 salt rounds)
- Trust proxy enabled in production for HTTPS behind reverse proxy (Nginx)
- Session configuration:
  - Secure cookies in production (HTTPS required)
  - SameSite: lax for same-site navigation
  - 24-hour session lifetime
  - Session stored server-side

**Database Layer**
- SQLite with better-sqlite3 driver
- Drizzle ORM for type-safe database operations
- Environment-aware database path:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db`
- Performance optimizations:
  - WAL (Write-Ahead Logging) journal mode
  - 5-second busy timeout
  - Foreign keys enabled
- Bootstrap system for schema migrations using `server/db/bootstrap.ts`
- Safe ALTER TABLE statements using `addColumnIfNotExists()` helper

**Data Models**
- Users: UUID-based IDs, bcrypt password hashing
- Items: Auto-incrementing IDs, SKU-based inventory items with safety stock levels
- Customers: Company information with contact details
- Orders: PO-based order management with line items
- Order Items: Junction table for order-item relationships with quantity tracking
- Batches: Production batches with quality status (Good/Acceptable/Rejected)
- Shipments: Fulfillment tracking with rejection counts by type
- Indents: Monthly inventory planning with expected receipts and safety stock

**Inventory Management**
- Two-tier inventory model:
  - Current Stock: Real-time from batches (single source of truth)
  - Working Stock: Current stock + expected receipts
  - Safety Stock: Buffer inventory (current and desired levels)
  - Usable Stock: Working + current safety stock
- Batch-driven stock calculations
- Quality-based filtering (Good/Acceptable/Rejected)
- Monthly indent planning for procurement

## Development & Build

**Development Mode**
- Vite dev server with HMR (Hot Module Replacement)
- TypeScript watch mode with incremental compilation
- Development server on port 5001
- Separate Vite middleware for asset serving

**Production Build**
- Vite builds client to `dist/public`
- esbuild bundles server to `dist/index.js`
- Static file serving from `dist/public`
- Environment-based configuration loading
- Single-file server bundle with external packages

**Type Safety**
- Shared types in `/shared` directory
- Drizzle Zod schemas for validation
- Type inference from database schema
- Path aliases for clean imports

# External Dependencies

## Core Framework Dependencies
- **Express.js**: Backend web server framework
- **React**: Frontend UI library
- **Vite**: Build tool and development server
- **TypeScript**: Type system for both client and server

## Database & ORM
- **better-sqlite3**: SQLite database driver
- **Drizzle ORM**: Type-safe database toolkit
- **drizzle-kit**: Schema migrations and management
- **drizzle-zod**: Zod schema generation from Drizzle schemas

## UI Component Libraries
- **Radix UI**: Headless accessible component primitives
  - Dialog, Select, Dropdown Menu, Toast, Tooltip, Accordion, etc.
- **Shadcn/ui**: Pre-styled components built on Radix UI
- **TailwindCSS**: Utility-first CSS framework
- **class-variance-authority**: CVA for component variants
- **Lucide React**: Icon library

## State Management & Data Fetching
- **TanStack Query** (React Query): Server state management
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod resolver for React Hook Form

## Authentication & Security
- **express-session**: Session management middleware
- **bcryptjs**: Password hashing
- **cors**: Cross-origin resource sharing

## Routing
- **Wouter**: Lightweight client-side routing

## Utilities
- **date-fns**: Date manipulation and formatting
- **clsx**: Conditional className composition
- **tailwind-merge**: Merge Tailwind classes intelligently
- **nanoid**: Unique ID generation

## Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: JavaScript bundler for production builds
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## Deployment Target
- **AWS LightSail**: Cloud hosting platform
- **Nginx**: Reverse proxy for production
- **systemd**: Service management on Linux

## Font Service
- **Google Fonts**: Inter font family via CDN