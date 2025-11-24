# Overview

Onyx Houseware Order Management System is a mini-CRM web application designed for a cookware manufacturing company. It manages the complete order lifecycle from customer inquiries to fulfillment, serving as a lightweight alternative to enterprise systems like Zoho Inventory. The application is optimized for a small manufacturing operation with a single shared admin user account.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework & Build System:**
- React with TypeScript as the primary UI framework
- Vite as the build tool for fast development and optimized production builds
- ES module mode throughout the application

**Routing:**
- Wouter library for client-side routing
- Chosen for minimal bundle size and simpler API compared to React Router
- Suitable for the application's straightforward navigation needs

**State Management:**
- TanStack Query (React Query) for all server state management
- Automatic caching, background refetching, and optimistic updates
- No global client state management - form state is handled locally with React Hook Form
- Query keys follow RESTful patterns (e.g., `['/api/orders']`, `['/api/items']`)

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives
- "New York" style variant configured in `components.json`
- Accessible, unstyled components customized with TailwindCSS
- Components include forms, dialogs, tables, badges, and data visualization elements

**Styling Architecture:**
- TailwindCSS with custom design tokens defined in CSS variables
- Dark/light mode support through CSS class-based theming
- Material Design principles adapted for enterprise data-heavy interfaces
- Consistent spacing scale: 2, 4, 6, 8, 12 Tailwind units
- Status-based color system: green (fulfilled), amber (draft/pending), red (cancelled/destructive), cyan (info)
- Inter font family from Google Fonts for general UI
- Monospace fonts for numerical data in tables

**Design Philosophy:**
- Utility-focused with data density prioritized over aesthetics
- Interface emphasizes clarity, learnability, and efficiency for daily administrative tasks
- 12-column responsive grid system
- Focus on productivity for data-heavy operations

## Backend Architecture

**Runtime & Framework:**
- Node.js with Express.js framework
- ES module mode enabled (not CommonJS)
- TypeScript for type safety across the stack

**Monorepo Structure:**
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schemas
- Single repository approach for simplified development and deployment

**API Design:**
- RESTful API with all endpoints prefixed with `/api/*`
- All routes require authentication except login/logout endpoints
- JSON request/response format
- Session-based authentication enforced via middleware

**Authentication & Authorization:**
- Session-based authentication using `express-session`
- httpOnly cookies for security
- Single shared admin account (no user registration system)
- Admin credentials stored in environment variables
- Passwords hashed with bcryptjs using 12 salt rounds
- Trust proxy enabled in production for deployment behind Nginx/reverse proxy

**Database Layer:**
- SQLite database using better-sqlite3 driver
- Drizzle ORM for type-safe database operations
- Environment-aware database path:
  - Development: `server/data/onyx.db`
  - Production: `/var/app/data/onyx.db`
- Database schema defined in `shared/schema.ts` using `sqliteTable`
- WAL (Write-Ahead Logging) mode enabled for better concurrency
- Foreign keys enforced at database level

**Data Model:**
- Users (admin authentication)
- Items (product catalog)
- Customers (client information)
- Orders (order headers with status tracking)
- Order Items (line items within orders)
- Batches (production batch tracking with quality status)
- Shipments (delivery tracking with rejection metrics)
- Indents (monthly inventory planning records)

**Schema Design Decisions:**
- UUIDs for user IDs (using `crypto.randomUUID()`)
- Auto-incrementing integers for all other primary keys
- Text fields for dates in ISO 8601 format
- Real numbers for decimal values (prices, quantities)
- Boolean flags stored as integers with `{ mode: 'boolean' }` for SQLite compatibility

**Inventory Management:**
- Two-tier inventory model (working stock + safety stock)
- Batch-driven current stock tracking (single source of truth)
- Monthly indent system for production planning
- Quality status tracking: Good, Acceptable, Rejected
- Real-time on-hand stock calculations from batch quantities

## External Dependencies

**Database:**
- SQLite via better-sqlite3
- No external database service required (embedded database)
- Database file stored locally or on persistent storage in production

**Session Storage:**
- In-memory session store via express-session (default)
- Sessions persist for 24 hours
- No external session store (Redis/Postgres) configured

**Third-Party UI Libraries:**
- Radix UI primitives for accessible component foundations
- Lucide React for icons
- TailwindCSS for styling
- React Hook Form with Zod for form validation
- date-fns for date manipulation

**Development Tools:**
- Vite for development server and build
- tsx for TypeScript execution in development
- esbuild for production server bundling
- Drizzle Kit for database migrations

**Deployment Target:**
- AWS LightSail for production hosting
- Nginx as reverse proxy
- Environment configuration via `.env` file
- Production build outputs to `dist/` directory
- Static assets served from `dist/public/`

**Font Loading:**
- Google Fonts CDN for Inter font family
- Preconnect optimization for font loading performance