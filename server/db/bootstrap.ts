import { db } from "./client";
import { sql } from "drizzle-orm";

/**
 * Helper function to safely add columns to existing tables
 * Catches "duplicate column" errors so ALTER TABLE statements can stay in bootstrap forever
 * 
 * @param tableName - Name of the table to modify
 * @param columnDef - Full column definition (e.g., "discount REAL DEFAULT 0")
 * @param columnName - Name of the column for logging purposes
 */
async function addColumnIfNotExists(
  tableName: string,
  columnDef: string,
  columnName: string
) {
  try {
    await db.run(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`));
    console.log(`✅ Added ${columnName} column to ${tableName}`);
  } catch (error: any) {
    // Ignore duplicate column errors - column already exists
    const errorMessage = error?.message?.toLowerCase() || '';
    const causeMessage = error?.cause?.message?.toLowerCase() || '';
    
    if (errorMessage.includes("duplicate column") || 
        causeMessage.includes("duplicate column") ||
        error?.cause?.code === 'SQLITE_ERROR') {
      // Column already exists, silently continue
      return;
    }
    
    // Re-throw if it's a different error
    throw error;
  }
}

/**
 * Bootstrap function to create SQLite tables and apply schema migrations
 * 
 * How to use this file:
 * - CREATE TABLE IF NOT EXISTS: Safe to keep forever, runs on every startup
 * - ALTER TABLE via addColumnIfNotExists(): Safe to keep forever, only runs once
 * 
 * For schema changes:
 * 1. Development: Run `npm run db:push` to quickly sync schema changes
 * 2. Production: Add ALTER TABLE statements below using addColumnIfNotExists()
 * 3. Deploy: Bootstrap runs automatically and applies changes safely
 */
export async function bootstrapDatabase() {
  try {
    // ========================================
    // CREATE TABLES (Safe to keep forever)
    // ========================================

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
        desired_safety_stock INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT
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
        address TEXT,
        notes TEXT
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
        status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT
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
        expected_receipts INTEGER NOT NULL DEFAULT 0,
        current_safety_stock INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create batches table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        batch_number TEXT NOT NULL UNIQUE,
        received_date TEXT NOT NULL,
        quantity_produced INTEGER NOT NULL,
        quantity_remaining INTEGER NOT NULL,
        quantity_rejected INTEGER NOT NULL DEFAULT 0,
        quality_status TEXT NOT NULL DEFAULT 'Good',
        notes TEXT,
        is_depleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create shipments table (using batch_number from the start)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        batch_number TEXT,
        quantity_shipped INTEGER NOT NULL,
        rejections_blowholes INTEGER NOT NULL DEFAULT 0,
        rejections_handles INTEGER NOT NULL DEFAULT 0,
        rejections_other INTEGER NOT NULL DEFAULT 0,
        shipment_date TEXT NOT NULL
      )
    `);

    // ========================================
    // SCHEMA MIGRATIONS (Safe to keep forever)
    // ========================================
    // Add new ALTER TABLE statements below using addColumnIfNotExists()
    // These will run once and then safely ignore duplicate column errors

    // Add notes fields to Items, Orders, Customers
    await addColumnIfNotExists(
      "items",
      "notes TEXT",
      "notes"
    );

    await addColumnIfNotExists(
      "orders",
      "notes TEXT",
      "notes"
    );

    await addColumnIfNotExists(
      "customers",
      "notes TEXT",
      "notes"
    );

    // Rename safety_stock to desired_safety_stock in Items
    // Note: SQLite doesn't support column rename directly, so we:
    // 1. Add new column desired_safety_stock
    // 2. Copy data from safety_stock (if it exists)
    // 3. Old column remains for backward compatibility
    await addColumnIfNotExists(
      "items",
      "desired_safety_stock INTEGER NOT NULL DEFAULT 0",
      "desired_safety_stock"
    );

    // Migrate data from old safety_stock to desired_safety_stock (one-time operation)
    try {
      const result = await db.run(sql`
        UPDATE items 
        SET desired_safety_stock = COALESCE(safety_stock, 0) 
        WHERE desired_safety_stock = 0 AND safety_stock IS NOT NULL
      `);
      if (result.changes && result.changes > 0) {
        console.log(`✅ Migrated ${result.changes} safety_stock values to desired_safety_stock`);
      }
    } catch (error: any) {
      // Ignore errors if migration already done or safety_stock column doesn't exist
      if (!error.message.includes("no such column")) {
        console.log("ℹ️ Safety stock migration skipped (likely already completed)");
      }
    }

    // Add current_safety_stock to Indents
    await addColumnIfNotExists(
      "indents",
      "current_safety_stock INTEGER NOT NULL DEFAULT 0",
      "current_safety_stock"
    );

    // Migration: Remove opening_balance from indents (November 2025)
    // Inventory is now calculated real-time from batches, not from snapshots
    try {
      await db.run(sql`ALTER TABLE indents DROP COLUMN opening_balance`);
      console.log("✅ Removed opening_balance column from indents table");
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes("no such column") || 
          errorMessage.includes("no column named")) {
        // Column already removed or never existed, silently continue
      } else {
        // Log other errors but don't fail the bootstrap
        console.log("ℹ️ opening_balance column removal skipped (likely already removed)");
      }
    }

    // Migration: Rename lot_number to batch_number in existing databases
    // For databases created before batch_number was added
    await addColumnIfNotExists(
      "shipments",
      "batch_number TEXT",
      "batch_number"
    );

    // Migrate data from lot_number to batch_number (one-time operation)
    try {
      const result = await db.run(sql`
        UPDATE shipments 
        SET batch_number = lot_number 
        WHERE batch_number IS NULL AND lot_number IS NOT NULL
      `);
      if (result.changes && result.changes > 0) {
        console.log(`✅ Migrated ${result.changes} lot_number values to batch_number`);
      }
    } catch (error: any) {
      // Ignore if lot_number column doesn't exist (new databases)
      if (!error.message.includes("no such column")) {
        console.log("ℹ️ Lot number migration skipped");
      }
    }

    // DISABLED: Create UNBATCHED batches for existing items with current inventory levels
    // This was a one-time legacy migration feature - now disabled to allow fresh starts
    // Commenting out to prevent auto-creation of UNBATCHED batches on server restart
    /*
    try {
      const result = await db.run(sql`
        INSERT OR IGNORE INTO batches (
          item_id, 
          batch_number, 
          received_date, 
          quantity_produced, 
          quantity_remaining, 
          quality_status,
          is_depleted,
          notes
        )
        SELECT 
          items.id,
          'UNBATCHED-' || items.id,
          date('now'),
          COALESCE(
            (SELECT opening_balance + current_safety_stock 
             FROM indents 
             WHERE indents.item_id = items.id 
             ORDER BY month DESC 
             LIMIT 1), 
            0
          ),
          COALESCE(
            (SELECT opening_balance + current_safety_stock 
             FROM indents 
             WHERE indents.item_id = items.id 
             ORDER BY month DESC 
             LIMIT 1), 
            0
          ),
          'Good',
          CASE 
            WHEN COALESCE(
              (SELECT opening_balance + current_safety_stock 
               FROM indents 
               WHERE indents.item_id = items.id 
               ORDER BY month DESC 
               LIMIT 1), 
              0
            ) = 0 THEN 1 
            ELSE 0 
          END,
          'Legacy inventory migrated from indent system. PLEASE VERIFY quantities before use.'
        FROM items
        WHERE NOT EXISTS (
          SELECT 1 FROM batches 
          WHERE batches.item_id = items.id 
          AND batches.batch_number = 'UNBATCHED-' || items.id
        )
      `);
      if (result.changes && result.changes > 0) {
        console.log(`✅ Created ${result.changes} UNBATCHED batch records with current inventory levels`);
        console.log(`⚠️  IMPORTANT: Review UNBATCHED quantities before go-live - they may not reflect actual stock`);
      }
    } catch (error: any) {
      console.log("ℹ️ UNBATCHED batch creation skipped (likely already completed)");
    }
    */

    console.log("✅ SQLite database tables initialized successfully");
  } catch (error) {
    console.error("❌ Error bootstrapping database:", error);
    throw error;
  }
}
