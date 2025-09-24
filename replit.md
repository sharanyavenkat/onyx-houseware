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
- **Database**: Configured for PostgreSQL with Drizzle ORM, but includes SQLite fallback support
- **Authentication**: Session-based auth using express-session with bcrypt password hashing
- **API Design**: RESTful endpoints under `/api/*` prefix with Zod validation
- **File Structure**: Monorepo with shared types between client and server

## Authentication System
- **Single Admin Model**: One shared admin account with credentials from environment variables
- **Session Management**: HTTP-only cookies with multiple concurrent sessions allowed
- **No Registration**: Login-only flow, no signup functionality
- **Password Security**: Bcrypt hashing with 12 salt rounds

## Database Design
- **ORM**: Drizzle with PostgreSQL as primary database
- **Schema Management**: Centralized schema definitions in shared folder
- **Migrations**: Drizzle-kit for database migrations
- **Connection**: Neon Database serverless PostgreSQL with connection pooling

## Key Business Entities
- **Items**: Product catalog with SKU, pricing, safety stock levels
- **Customers**: Company information with PO numbers and billing details  
- **Orders**: Header/line item structure with status workflow (draft → confirmed → fulfilled → cancelled)
- **Indent**: Monthly inventory planning with automatic order quantity calculations

## Development Workflow
- **Development**: Concurrent client/server with Vite proxy
- **Build**: Client builds to `dist/public`, server bundles with esbuild
- **Production**: Express serves static files and API routes

# External Dependencies

## Database & ORM
- **@neondatabase/serverless**: PostgreSQL serverless driver for Neon Database
- **drizzle-orm**: Type-safe SQL ORM with PostgreSQL dialect
- **drizzle-kit**: Database migration and schema management tool
- **better-sqlite3**: SQLite fallback database support

## Authentication & Security
- **bcryptjs**: Password hashing with salt rounds
- **express-session**: Server-side session management
- **connect-pg-simple**: PostgreSQL session store adapter

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