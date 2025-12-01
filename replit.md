# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. The system manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. It is optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build Tool**
- React with TypeScript using Vite for fast development and optimized production builds
- ES modules for modern JavaScript support

**Routing Solution**
- Wouter library for lightweight client-side routing
- Chosen over React Router for minimal bundle size and simpler API
- Suitable for straightforward navigation requirements

**State Management Strategy**
- TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates
- No global client state management library
- Form state managed locally within components

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives
- "New York" style variant configured
- Accessible, unstyled base components customized with TailwindCSS
- Components located in `client/src/components/ui/`

**Styling & Design System**
- TailwindCSS with custom design tokens defined via CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Consistent spacing scale: 2, 4, 6, 8, 12 Tailwind units
- Status-based color system:
  - Green: fulfilled orders
  - Amber: draft/pending states
  - Red: cancelled/destructive actions
  - Cyan: informational content
- Typography: Inter font family from Google Fonts, monospace fonts for numerical table data
- 12-column responsive grid system
- Utility-focused design prioritizing data density, clarity, learnability, and efficiency

## Backend Architecture

**Runtime & Framework**
- Node.js with Express.js framework
- ES module mode for modern JavaScript
- TypeScript for type safety

**Monorepo Structure**
- Single repository with three main directories:
  - `client/` - React frontend application
  - `server/` - Express backend API
  - `shared/` - Shared TypeScript types and schemas (ensures type safety across full stack)

**API Design**
- RESTful API with endpoints prefixed `/api/*`
- All API routes require authentication except login/logout
- Session-based request handling

**Authentication & Authorization**
- Session-based authentication using `express-session` with httpOnly cookies
- Single shared admin account (no user registration system)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs using 12 salt rounds
- Session cookie configuration:
  - httpOnly for XSS protection
  - secure flag enabled in production (requires HTTPS)
  - sameSite: 'lax' for CSRF protection
  - 24-hour expiration
- Trust proxy setting enabled in production for reverse proxy compatibility (Nginx)

**Data Persistence**
- SQLite database using better-sqlite3 driver
- Drizzle ORM for type-safe database operations
- Environment-aware database paths:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db`
- Database PRAGMAs: WAL journal mode, 5-second busy timeout, foreign keys enabled
- Schema bootstrap function in `server/db/bootstrap.ts` for table creation and migrations
- Support for safe schema changes via `addColumnIfNotExists` helper

**Type Safety**
- Shared type definitions between client and server in `/shared` directory
- Drizzle Zod schemas for runtime validation
- End-to-end type safety from database to frontend

**Build & Deployment**
- Development: tsx for TypeScript execution with hot reload
- Production: esbuild bundles server code to `dist/index.js`
- Frontend built with Vite to `dist/public`
- Static file serving from built frontend in production

## External Dependencies

**Database**
- SQLite with better-sqlite3 driver (no external database service required)
- Drizzle ORM for schema management and queries
- File-based storage suitable for small-scale deployment

**UI Libraries**
- Radix UI primitives for accessible component foundations
- TailwindCSS for utility-first styling
- Lucide React for icons
- React Hook Form with Zod resolvers for form handling
- date-fns for date manipulation

**Development Tools**
- Vite for frontend build tooling
- TypeScript compiler for type checking
- esbuild for server-side bundling
- tsx for development server execution

**Session Management**
- express-session for server-side session handling
- No external session store (uses in-memory storage)

**Deployment Target**
- AWS LightSail as production environment
- Nginx as reverse proxy
- systemd for process management
- Environment variables via `.env` file

**Third-Party Services**
- Google Fonts CDN for Inter font family
- No external APIs or third-party integrations

**Inventory Model**
- Two-tier inventory system with working stock and safety stock concepts
- Batch-driven inventory tracking with quality status (Good, Acceptable, Rejected)
- Shared inventory calculation utilities in `shared/inventory.ts`

## Mobile Responsiveness

**Sidebar Navigation**
- Desktop: Fixed left sidebar with navigation items
- Mobile: Hamburger menu in fixed header opens Sheet drawer
- Breakpoint: Uses Tailwind's md (768px) for responsive switching
- Header padding: `pt-14` added to main content on mobile for fixed header

**DataTable Component**
- Desktop: Traditional table layout with columns
- Mobile: Card-based layout with primary field as card header
- Column configuration: `isPrimary` (main display), `hideOnMobile` (hide less critical fields)
- Actions: View/Edit/Delete buttons shown on mobile cards (respects canMutate for role-based access)
- `onView` handler support for custom view actions (used for order detail navigation)

**Role-Based Access**
- Admin role: Full CRUD access on all pages
- Viewer role: Read-only access, action buttons hidden except View
- Middleware: `requireAdmin` blocks mutation endpoints for viewer role
- Frontend: `canMutate` prop controls visibility of edit/delete actions