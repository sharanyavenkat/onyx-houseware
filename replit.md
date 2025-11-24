# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. The system manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. It is optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System:**
- React with TypeScript using Vite for fast development and optimized production builds
- ES modules throughout the codebase

**Routing:**
- Wouter library chosen over React Router for minimal bundle size and simpler API
- Client-side routing for a single-page application experience

**State Management:**
- TanStack Query (React Query) handles all server state with automatic caching, background refetching, and optimistic updates
- No global client state management—form state is managed locally with React Hook Form
- Queries cached at component level with automatic invalidation on mutations

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives (accessible, unstyled components)
- "New York" style variant configured in components.json
- Components customized with TailwindCSS for consistent styling

**Styling & Design:**
- TailwindCSS with custom design tokens defined in CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Utility-focused design prioritizing data density over aesthetics
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Typography: Inter font family from Google Fonts, monospace fonts for numerical data
- Consistent spacing scale: 2, 4, 6, 8, 12 Tailwind units
- 12-column responsive grid system

## Backend Architecture

**Runtime & Framework:**
- Node.js with Express.js framework
- ES module mode throughout
- TypeScript for type safety

**Monorepo Structure:**
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schemas for full-stack type safety

**API Design:**
- RESTful API with all endpoints prefixed with `/api/*`
- All API routes require authentication except login/logout endpoints
- Session-based authentication with httpOnly cookies

**Authentication & Authorization:**
- Single shared admin account (no user registration)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs (12 salt rounds)
- express-session middleware for session management
- Session stored in memory (development) or can be configured for production storage

**Data Layer:**
- Drizzle ORM for database operations
- Shared schema definitions in `/shared/schema.ts`
- Type-safe database queries with full TypeScript support

## Data Storage

**Database:**
- SQLite using better-sqlite3 driver
- Migrated from PostgreSQL to SQLite for simplified deployment
- Database file location controlled via `DATABASE_URL` environment variable
- Development: `server/data/onyx.db`
- Production: `/var/app/data/onyx.db` (AWS LightSail)

**Database Configuration:**
- WAL (Write-Ahead Logging) mode for better concurrency
- Foreign keys enforcement enabled
- 5-second busy timeout for handling concurrent access
- Schema migrations via Drizzle Kit

**Database Schema:**
- Users: Admin authentication (UUID primary keys)
- Items: Product catalog with SKU, pricing, safety stock levels
- Customers: Company contacts and details
- Orders: Purchase orders with status tracking
- Order Items: Line items for each order
- Batches: Production batches with quality status (Good/Acceptable/Rejected)
- Shipments: Delivery tracking with rejection reasons
- Indents: Monthly inventory planning with expected receipts and safety stock

**Key Schema Decisions:**
- UUIDs for user IDs (crypto.randomUUID())
- Auto-incrementing integers for all other primary keys
- Text fields for dates stored in ISO 8601 format
- Real (floating-point) for numeric values like prices
- Boolean fields stored as integers with `{ mode: 'boolean' }`

## External Dependencies

**Core Dependencies:**
- **Express.js**: Web server framework
- **React**: Frontend UI library
- **TypeScript**: Type safety across full stack
- **Vite**: Frontend build tool and dev server
- **Drizzle ORM**: Database toolkit with better-sqlite3
- **TanStack Query**: Server state management
- **Wouter**: Lightweight routing
- **Zod**: Schema validation

**UI & Styling:**
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management
- **React Hook Form**: Form state management

**Authentication:**
- **express-session**: Session middleware
- **bcryptjs**: Password hashing

**Development:**
- **tsx**: TypeScript execution for development
- **esbuild**: Production build bundler for backend
- **dotenv**: Environment variable management

**Date Handling:**
- **date-fns**: Date formatting and manipulation utilities

**Deployment Target:**
- AWS LightSail configured as production environment
- Nginx reverse proxy in front of Node.js application
- Environment-specific database paths and session configuration