import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const DATABASE_URL = process.env.DATABASE_URL || 'server/data/onyx.db';

async function removeOpeningBalance() {
  const sqlite = new Database(DATABASE_URL);
  const db = drizzle(sqlite);

  try {
    console.log('Starting migration to remove opening_balance column from indents table...');

    // Step 1: Create new indents table without opening_balance
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS indents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        month TEXT NOT NULL,
        expected_receipts INTEGER NOT NULL DEFAULT 0,
        current_safety_stock INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('✓ Created new indents table structure');

    // Step 2: Copy data from old table to new table (excluding opening_balance)
    await db.run(sql`
      INSERT INTO indents_new (id, item_id, month, expected_receipts, current_safety_stock)
      SELECT id, item_id, month, expected_receipts, current_safety_stock
      FROM indents
    `);
    console.log('✓ Copied data to new table');

    // Step 3: Drop old table
    await db.run(sql`DROP TABLE indents`);
    console.log('✓ Dropped old indents table');

    // Step 4: Rename new table
    await db.run(sql`ALTER TABLE indents_new RENAME TO indents`);
    console.log('✓ Renamed new table to indents');

    // Step 5: Recreate unique constraint if needed
    await db.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS indents_item_month_unique 
      ON indents(item_id, month)
    `);
    console.log('✓ Recreated unique index');

    console.log('✅ Migration completed successfully!');
    sqlite.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    sqlite.close();
    process.exit(1);
  }
}

removeOpeningBalance();
