# Overview

This is an Onyx Houseware order management system - a mini CRM web application designed for a cookware manufacturing company. The system manages orders, items, customers, and inventory indenting with a single shared admin authentication model. It's built as a full-stack TypeScript application focusing on order processing workflows and inventory management for products like tawas, fry pans, kadais, and casseroles.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: TailwindCSS with custom design system following Material Design principles
- **State Management**: TanStack Query for server state management
- **Design System**: Custom dark/light mode with utility-focused components, Inter font, and enterprise-focused color palette

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: SQLite with Drizzle ORM and better-sqlite3 driver (migrated from PostgreSQL)
- **Authentication**: Session-based auth using express-session with bcrypt password hashing and memory store
- **API Design**: RESTful endpoints under `/api/*` prefix with Zod validation
- **File Structure**: Monorepo with shared types between client and server

## Authentication System
- **Single Admin Model**: One shared admin account with credentials from environment variables
- **Session Management**: HTTP-only cookies with multiple concurrent sessions allowed
- **No Registration**: Login-only flow, no signup functionality
- **Password Security**: Bcrypt hashing with 12 salt rounds

## Database Design
- **ORM**: Drizzle ORM with SQLite dialect
- **Driver**: better-sqlite3 for synchronous SQLite operations
- **Storage**: Local SQLite file at `./server/data/onyx.db`
- **Schema Management**: Centralized schema definitions in shared folder
- **Migrations**: Drizzle-kit for database migrations (requires manual drizzle.config.ts update)
- **Performance**: WAL mode enabled, 5-second busy timeout configured

## Key Business Entities
- **Items**: Product catalog with SKU, pricing, safety stock levels
- **Customers**: Company information (only company_name is required; contact_person, email, phone, address are optional)
- **Orders**: Header/line item structure with PO numbers, status workflow (draft → confirmed → fulfilled → cancelled), order date, and fulfillment date
- **Indent**: Monthly inventory planning with automatic order quantity calculations

## Key Features
- **Dashboard**: 
  - Overview cards with total orders, pending orders, items, and customers
  - Clickable pending orders card filters to pending orders (draft + confirmed status)
  - Top items by pending quantity with status indicators (Critical/Low/Good based on safety stock ratios)
  - Pending quantity explanation: Total from orders in Draft or Confirmed status
  - Month filter based on fulfillment dates
  
- **Orders Page**:
  - Dual filtering: by month (order date) and by status
  - Status filter options: All, Pending (Draft+Confirmed), Draft, Confirmed, Fulfilled, Cancelled
  - URL parameter support (?filter=pending) from dashboard navigation
  - Columns: PO Number, Customer, Order Date, Fulfillment Date, Items Count, Total Pieces, Status
  
- **Navigation**: 
  - Sidebar order: Dashboard → Orders → Indent → Items → Customers
  - Collapsible sidebar with icon-only mode

## Development Workflow
- **Development**: Concurrent client/server with Vite proxy
- **Build**: Client builds to `dist/public`, server bundles with esbuild
- **Production**: Express serves static files and API routes

# External Dependencies

## Database & ORM
- **better-sqlite3**: SQLite database driver for local file-based storage
- **drizzle-orm**: Type-safe SQL ORM with SQLite dialect
- **drizzle-kit**: Database migration and schema management tool

## Authentication & Security
- **bcryptjs**: Password hashing with salt rounds
- **express-session**: Server-side session management with memory store

## UI & Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library for consistent iconography

## Development Tools
- **@tanstack/react-query**: Server state management and caching
- **@hookform/resolvers**: Form validation integration
- **wouter**: Lightweight React router
- **vite**: Fast build tool and development server
- **typescript**: Type safety across the application