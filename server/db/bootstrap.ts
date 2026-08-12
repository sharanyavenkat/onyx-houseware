import { db } from "./client";
import { sql } from "drizzle-orm";
import { appSettings } from "@shared/schema";

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
        size_specification TEXT NOT NULL,
        price REAL NOT NULL,
        desired_safety_stock INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      )
    `);

    // Add unit_weight_kg column to items table (finished-casting weight, used
    // to reconcile ingot dispatched to a caster against casting weight received)
    await addColumnIfNotExists(
      "items",
      "unit_weight_kg REAL",
      "unit_weight_kg"
    );
    // Kits (combo packs like CSTONE 10) are never cast themselves; finish tags
    // bare/nonstick/ceramic casting variants, each tracked as its own item
    await addColumnIfNotExists("items", "is_kit INTEGER NOT NULL DEFAULT 0", "is_kit");
    await addColumnIfNotExists("items", "finish TEXT", "finish");

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
    // Business-line tag: 'oem' | 'kreme' | 'd2c'
    await addColumnIfNotExists("orders", "channel TEXT NOT NULL DEFAULT 'oem'", "channel");

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
    // false (default) = expected_receipts auto-derived from open POs; true = manually overridden
    await addColumnIfNotExists(
      "indents",
      "is_manual_expected_receipts INTEGER NOT NULL DEFAULT 0",
      "is_manual_expected_receipts"
    );

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

    // Create invoices table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        invoice_number TEXT NOT NULL,
        invoice_date TEXT,
        notes TEXT
      )
    `);

    // Create shipments table (using batch_number from the start)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        shipment_number TEXT,
        batch_number TEXT,
        quantity_shipped INTEGER NOT NULL,
        rejections_blowholes INTEGER NOT NULL DEFAULT 0,
        rejections_handles INTEGER NOT NULL DEFAULT 0,
        rejections_other INTEGER NOT NULL DEFAULT 0,
        shipment_date TEXT NOT NULL,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL
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

    // Add role column to users table (for read-only admin support)
    await addColumnIfNotExists(
      "users",
      "role TEXT NOT NULL DEFAULT 'admin'",
      "role"
    );

    // Add shipment_number column to shipments table (for invoice tracking)
    await addColumnIfNotExists(
      "shipments",
      "shipment_number TEXT",
      "shipment_number"
    );

    // Add invoice_id column to shipments table (for linking shipments to invoices)
    await addColumnIfNotExists(
      "shipments",
      "invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL",
      "invoice_id"
    );

    // Add order_type column to orders table (standard/sample)
    await addColumnIfNotExists(
      "orders",
      "order_type TEXT NOT NULL DEFAULT 'standard'",
      "order_type"
    );

    // Add is_free_sample column to orders table
    await addColumnIfNotExists(
      "orders",
      "is_free_sample INTEGER NOT NULL DEFAULT 0",
      "is_free_sample"
    );

    // Create accessories table for tracking induction plates, handles, etc.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS accessories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT,
        stock_on_hand INTEGER NOT NULL DEFAULT 0,
        safety_stock INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT
      )
    `);

    // Add status column to accessories table
    await addColumnIfNotExists(
      "accessories",
      "status TEXT NOT NULL DEFAULT 'active'",
      "status"
    );

    // Create casters table for tracking casting suppliers
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS casters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        notes TEXT
      )
    `);

    // Add vendor master columns to casters table (contact info, lead time,
    // payment terms, active/inactive status)
    await addColumnIfNotExists("casters", "contact_person TEXT", "contact_person");
    await addColumnIfNotExists("casters", "phone TEXT", "phone");
    await addColumnIfNotExists("casters", "email TEXT", "email");
    await addColumnIfNotExists("casters", "lead_time_days INTEGER", "lead_time_days");
    await addColumnIfNotExists("casters", "payment_terms TEXT", "payment_terms");
    await addColumnIfNotExists(
      "casters",
      "status TEXT NOT NULL DEFAULT 'active'",
      "status"
    );
    // Generalize casters into "any vendor" via vendor_type, plus material-type
    // wastage defaults (null = fall back to company-wide 6% ingot / 8% scrap)
    await addColumnIfNotExists(
      "casters",
      "vendor_type TEXT NOT NULL DEFAULT 'caster'",
      "vendor_type"
    );
    await addColumnIfNotExists("casters", "default_wastage_ingot_pct REAL", "default_wastage_ingot_pct");
    await addColumnIfNotExists("casters", "default_wastage_scrap_pct REAL", "default_wastage_scrap_pct");

    // Add caster_id column to batches table (references casters)
    await addColumnIfNotExists(
      "batches",
      "caster_id INTEGER REFERENCES casters(id)",
      "caster_id"
    );

    // Add quantity_received column to batches table (raw qty from caster before QC)
    await addColumnIfNotExists(
      "batches",
      "quantity_received INTEGER NOT NULL DEFAULT 0",
      "quantity_received"
    );

    // Add is_manual_quantity column to batches table (when final qty differs from calculated)
    await addColumnIfNotExists(
      "batches",
      "is_manual_quantity INTEGER NOT NULL DEFAULT 0",
      "is_manual_quantity"
    );

    // Migration: For existing batches, set quantity_received = quantity_produced + quantity_rejected
    try {
      const result = await db.run(sql`
        UPDATE batches 
        SET quantity_received = quantity_produced + quantity_rejected 
        WHERE quantity_received = 0 AND quantity_produced > 0
      `);
      if (result.changes && result.changes > 0) {
        console.log(`✅ Backfilled quantity_received for ${result.changes} existing batches`);
      }
    } catch (error: any) {
      console.log("ℹ️ Batch quantity_received backfill skipped");
    }

    // Migration: Remove rejection columns from shipments table (January 2026)
    // Rejections now happen at caster receipt (batch level), not at customer shipment
    try {
      const tableInfo = await db.all(sql`PRAGMA table_info(shipments)`);
      const hasRejectionsColumns = tableInfo.some((col: any) => col.name === 'rejections_blowholes');
      
      if (hasRejectionsColumns) {
        await db.run(sql`PRAGMA foreign_keys=OFF`);
        
        try {
          await db.run(sql`BEGIN TRANSACTION`);
          
          // Create new shipments table without rejection columns
          await db.run(sql`
            CREATE TABLE shipments_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
              order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
              shipment_number TEXT,
              batch_number TEXT,
              quantity_shipped INTEGER NOT NULL,
              shipment_date TEXT NOT NULL,
              invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL
            )
          `);
          
          // Copy data (excluding rejection columns)
          await db.run(sql`
            INSERT INTO shipments_new (id, order_id, order_item_id, shipment_number, batch_number, quantity_shipped, shipment_date, invoice_id)
            SELECT id, order_id, order_item_id, shipment_number, batch_number, quantity_shipped, shipment_date, invoice_id
            FROM shipments
          `);
          
          await db.run(sql`DROP TABLE shipments`);
          await db.run(sql`ALTER TABLE shipments_new RENAME TO shipments`);
          await db.run(sql`COMMIT`);
          
          console.log("✅ Removed rejection columns from shipments table (table rebuilt)");
        } catch (rebuildError) {
          await db.run(sql`ROLLBACK`);
          throw rebuildError;
        } finally {
          await db.run(sql`PRAGMA foreign_keys=ON`);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      if (!errorMessage.includes("no such column") && !errorMessage.includes("no such table")) {
        console.log("ℹ️ Shipments rejection columns removal skipped:", error.message);
      }
    }

    // Migration: Remove product_type from items table (December 2025)
    // All items are now considered cookware; utensils go to accessories
    // Uses safe table rebuild approach for SQLite compatibility
    try {
      // Check if product_type column exists
      const tableInfo = await db.all(sql`PRAGMA table_info(items)`);
      const hasProductType = tableInfo.some((col: any) => col.name === 'product_type');
      
      if (hasProductType) {
        // Temporarily disable foreign keys for table rebuild
        await db.run(sql`PRAGMA foreign_keys=OFF`);
        
        try {
          // Begin transaction for safe rebuild
          await db.run(sql`BEGIN TRANSACTION`);
          
          // Create new table without product_type
          await db.run(sql`
            CREATE TABLE items_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              sku TEXT NOT NULL UNIQUE,
              size_specification TEXT NOT NULL,
              price REAL NOT NULL,
              desired_safety_stock INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              notes TEXT
            )
          `);
          
          // Copy data from old table (excluding product_type)
          await db.run(sql`
            INSERT INTO items_new (id, name, sku, size_specification, price, desired_safety_stock, is_active, notes)
            SELECT id, name, sku, size_specification, price, COALESCE(desired_safety_stock, 0), COALESCE(is_active, 1), notes
            FROM items
          `);
          
          // Drop old table
          await db.run(sql`DROP TABLE items`);
          
          // Rename new table
          await db.run(sql`ALTER TABLE items_new RENAME TO items`);
          
          // Commit transaction
          await db.run(sql`COMMIT`);
          
          console.log("✅ Removed product_type column from items table (table rebuilt)");
        } catch (rebuildError) {
          // Rollback on error
          await db.run(sql`ROLLBACK`);
          throw rebuildError;
        } finally {
          // Re-enable foreign keys
          await db.run(sql`PRAGMA foreign_keys=ON`);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes("no such column") || 
          errorMessage.includes("no column named") ||
          errorMessage.includes("no such table")) {
        // Column/table already processed, silently continue
      } else {
        console.log("ℹ️ product_type column removal skipped:", error.message);
      }
    }

    // Auto-generate shipment numbers for existing shipments without them
    try {
      const result = await db.run(sql`
        UPDATE shipments 
        SET shipment_number = 'SHP-' || printf('%03d', id)
        WHERE shipment_number IS NULL
      `);
      if (result.changes && result.changes > 0) {
        console.log(`✅ Generated shipment numbers for ${result.changes} existing shipments`);
      }
    } catch (error: any) {
      console.log("ℹ️ Shipment number generation skipped");
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

    // Create purchase_orders table for tracking orders to casters
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        caster_id INTEGER NOT NULL REFERENCES casters(id),
        order_date TEXT NOT NULL,
        expected_delivery_date TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        notes TEXT
      )
    `);

    // Create purchase_order_items table for line items on purchase orders
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id),
        quantity_ordered INTEGER NOT NULL,
        quantity_received INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Add purchase_order_id column to batches table (link batches to purchase orders)
    await addColumnIfNotExists(
      "batches",
      "purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL",
      "purchase_order_id"
    );

    // Create ingot_dispatches table for tracking raw aluminium ingot/scrap sent to casters
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS ingot_dispatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caster_id INTEGER NOT NULL REFERENCES casters(id),
        dispatch_date TEXT NOT NULL,
        material_type TEXT NOT NULL DEFAULT 'ingot',
        alloy_grade TEXT,
        quantity_kg REAL NOT NULL,
        purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        notes TEXT
      )
    `);
    // Safety net in case ingot_dispatches already existed from an earlier version without material_type
    await addColumnIfNotExists(
      "ingot_dispatches",
      "material_type TEXT NOT NULL DEFAULT 'ingot'",
      "material_type"
    );

    // Per-SKU wastage override for a specific vendor (overrides that vendor's
    // material-type default). material_type NULL = applies to both ingot and scrap.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS sku_wastage_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caster_id INTEGER NOT NULL REFERENCES casters(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        material_type TEXT,
        wastage_pct REAL NOT NULL,
        notes TEXT
      )
    `);

    // Dies/moulds Onyx owns, held at a vendor (casting dies at casters, handle
    // moulds at handle vendors)
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS dies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caster_id INTEGER NOT NULL REFERENCES casters(id),
        item_id INTEGER NOT NULL REFERENCES items(id),
        mould_type TEXT NOT NULL DEFAULT 'casting',
        shot_count INTEGER NOT NULL DEFAULT 0,
        last_rework_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT
      )
    `);

    // Rework: defective batch swapped 1:1 for good pieces by one caster.
    // Free — does not touch the main ingot/scrap metal balance.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS reworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caster_id INTEGER NOT NULL REFERENCES casters(id),
        item_id INTEGER NOT NULL REFERENCES items(id),
        original_batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
        quantity_defective INTEGER NOT NULL,
        sent_date TEXT NOT NULL,
        quantity_replaced INTEGER NOT NULL DEFAULT 0,
        replacement_batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
        replacement_received_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT
      )
    `);

    // Monthly vendor metal statement — both Onyx's calculated figures and (when
    // provided) the vendor's own reported figures, for side-by-side reconciliation.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS vendor_metal_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caster_id INTEGER NOT NULL REFERENCES casters(id),
        period_month TEXT NOT NULL,
        opening_balance_kg REAL NOT NULL DEFAULT 0,
        dispatched_kg REAL NOT NULL DEFAULT 0,
        expected_received_kg REAL NOT NULL DEFAULT 0,
        actual_received_kg REAL NOT NULL DEFAULT 0,
        closing_balance_kg REAL NOT NULL DEFAULT 0,
        vendor_reported_produced_kg REAL,
        vendor_reported_received_kg REAL,
        vendor_reported_remaining_kg REAL,
        status TEXT NOT NULL DEFAULT 'draft',
        sent_date TEXT,
        ack_date TEXT,
        notes TEXT
      )
    `);

    // BOM: what a kit item (items.is_kit = 1) contains. Fully data-driven —
    // new combo packs are just new rows, no schema change needed.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS bom_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        component_type TEXT NOT NULL,
        component_item_id INTEGER REFERENCES items(id),
        component_accessory_id INTEGER REFERENCES accessories(id),
        qty_per_kit INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Generic app settings key-value store, seeded with the current
    // hardcoded wastage defaults so behavior doesn't change until someone
    // edits them on the Settings page.
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      )
    `);
    const existingSettings = await db.select().from(appSettings);
    const existingKeys = new Set(existingSettings.map(s => s.key));
    const seedDefaults: Array<[string, string]> = [
      ["default_wastage_ingot_pct", "6"],
      ["default_wastage_scrap_pct", "8"],
    ];
    for (const [key, value] of seedDefaults) {
      if (!existingKeys.has(key)) {
        await db.insert(appSettings).values({ key, value, updated_at: new Date().toISOString() });
      }
    }

    console.log("✅ SQLite database tables initialized successfully");
  } catch (error) {
    console.error("❌ Error bootstrapping database:", error);
    throw error;
  }
}
