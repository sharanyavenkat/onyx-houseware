import { db } from "./client";
import { sql } from "drizzle-orm";

/**
 * Bootstrap function to create SQLite tables if they don't exist
 * This is needed because drizzle.config.ts is protected and db:push cannot run
 */
export async function bootstrapDatabase() {
  try {
    // Create users table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);

    // Create items table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        product_type TEXT NOT NULL,
        size_specification TEXT NOT NULL,
        price REAL NOT NULL,
        safety_stock INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Create customers table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT
      )
    `);

    // Create orders table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        order_date TEXT NOT NULL,
        fulfillment_date TEXT,
        status TEXT NOT NULL DEFAULT 'draft'
      )
    `);

    // Create order_items table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id),
        quantity INTEGER NOT NULL
      )
    `);

    // Create indents table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS indents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        month TEXT NOT NULL,
        opening_balance INTEGER NOT NULL DEFAULT 0,
        expected_receipts INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create shipments table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        lot_number TEXT,
        quantity_shipped INTEGER NOT NULL,
        rejections_blowholes INTEGER NOT NULL DEFAULT 0,
        rejections_handles INTEGER NOT NULL DEFAULT 0,
        rejections_other INTEGER NOT NULL DEFAULT 0,
        shipment_date TEXT NOT NULL
      )
    `);

    console.log("SQLite database tables initialized successfully");
  } catch (error) {
    console.error("Error bootstrapping database:", error);
    throw error;
  }
}
