# Onyx Houseware Order Management System

## Overview

A mini-CRM web application for a cookware manufacturing company that manages the complete order lifecycle from customer inquiries to fulfillment. The system serves as a lightweight alternative to enterprise systems like Zoho Inventory, optimized for a small manufacturing operation with role-based access (admin and viewer accounts).

Key features include:
- Order management with line items, shipments, and invoices
- Inventory tracking with batch-based stock management
- Indent (purchase planning) with safety stock calculations
- Customer and caster (supplier) management
- Accessories inventory tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework:** React 18 with TypeScript, built with Vite
- **Routing:** Wouter (lightweight alternative to React Router)
- **State Management:** TanStack Query for server state with automatic caching and background refetching
- **UI Components:** Shadcn/ui (New York style) built on Radix UI primitives
- **Styling:** TailwindCSS with CSS variables for theming, dark/light mode support

### Backend Architecture

- **Runtime:** Node.js with Express.js in ES module mode
- **Language:** TypeScript with shared types between client and server (`/shared` directory)
- **API Design:** RESTful endpoints prefixed with `/api/*`, all routes require authentication except login/logout
- **Authentication:** Session-based with express-session, httpOnly cookies, bcryptjs password hashing (12 salt rounds)
- **Authorization:** Role-based access control (admin can mutate, viewer is read-only)

### Data Storage

- **Database:** SQLite with better-sqlite3 driver
- **ORM:** Drizzle ORM with SQLite dialect
- **Schema Location:** `shared/schema.ts` defines all tables and Zod validation schemas
- **Database Path:** Configured via `DATABASE_URL` environment variable (defaults to `server/data/onyx.db`)
- **Migrations:** Bootstrap function in `server/db/bootstrap.ts` handles table creation and schema changes

### Monorepo Structure

```
client/          # React frontend application
server/          # Express backend API
shared/          # Shared TypeScript types and schemas
dist/            # Production build output
  public/        # Built frontend assets
  index.js       # Bundled backend
```

### Build Configuration

- **Development:** `npm run dev` runs tsx with hot reload
- **Production Build:** Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.js`
- **Database Sync:** `npm run db:push` uses drizzle-kit to push schema changes

## External Dependencies

### Core Dependencies
- **better-sqlite3:** SQLite database driver
- **drizzle-orm:** Type-safe ORM for database operations
- **express-session:** Session management for authentication
- **bcryptjs:** Password hashing

### Frontend Libraries
- **@tanstack/react-query:** Server state management
- **@radix-ui/*:** Accessible UI primitives
- **tailwindcss:** Utility-first CSS framework
- **wouter:** Lightweight routing
- **zod:** Schema validation (used with drizzle-zod)

### Build Tools
- **vite:** Frontend build tool
- **esbuild:** Backend bundler
- **tsx:** TypeScript execution for development
- **drizzle-kit:** Database migration tool

### Environment Variables Required
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: Admin account credentials
- `VIEWER_USERNAME` / `VIEWER_PASSWORD`: Optional viewer account credentials
- `SESSION_SECRET`: Secret for session encryption
- `DATABASE_URL`: Path to SQLite database file