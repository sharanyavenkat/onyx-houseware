import Database from "better-sqlite3";

const db = new Database("server/data/onyx.db", { readonly: true });

console.log("\n=== BATCH INFO ===");
const batch = db.prepare("SELECT * FROM batches WHERE batch_number = ?").get("TW240251120");
console.log(JSON.stringify(batch, null, 2));

console.log("\n=== SHIPMENTS FOR THIS BATCH ===");
const shipments = db.prepare("SELECT id, order_id, order_item_id, batch_number, quantity_shipped, rejections_blowholes, rejections_handles, rejections_other FROM shipments WHERE batch_number = ? ORDER BY id DESC LIMIT 5").all("TW240251120");
console.log(JSON.stringify(shipments, null, 2));

db.close();
