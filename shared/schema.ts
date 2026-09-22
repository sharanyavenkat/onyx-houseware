import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  size_specification: text("size_specification").notNull(),
  price: real("price").notNull(),
  desired_safety_stock: integer("desired_safety_stock").notNull().default(0),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  unit_weight_kg: real("unit_weight_kg"),
  // Kits (e.g. CSTONE 10) are never cast themselves — no batches, no unit_weight_kg.
  // Their contents are defined in bom_components.
  is_kit: integer("is_kit", { mode: "boolean" }).notNull().default(false),
  // Optional tag for casting variants — 'bare' | 'nonstick' | 'ceramic' — since each
  // finish is tracked as its own item/SKU with its own stock, not a shared pool.
  finish: text("finish"),
  // For a coated item (finish = nonstick/ceramic), points back to the bare
  // item it's converted from — e.g. "Kadai 240 NS" -> "Kadai 240". This is
  // the link that lets Indent trace kit/coated demand down to what you'd
  // actually order from a caster (always the bare casting). Null for bare
  // items and kits.
  bare_item_id: integer("bare_item_id").references((): any => items.id),
  notes: text("notes"),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company_name: text("company_name").notNull(),
  contact_person: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  po_number: text("po_number").notNull().unique(),
  customer_id: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  order_date: text("order_date").notNull(),
  fulfillment_date: text("fulfillment_date"),
  status: text("status").notNull().default("draft"),
  order_type: text("order_type").notNull().default("standard"),
  is_free_sample: integer("is_free_sample", { mode: "boolean" }).notNull().default(false),
  // 'oem' | 'd2c' — what physically ships: raw castings (oem) vs.
  // coated/finished pieces (d2c), regardless of which customer it is.
  // Reporting/dashboard filter; doesn't change how orders/order_items work.
  channel: text("channel").notNull().default("oem"),
  notes: text("notes"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull(),
  // Free-text color/pattern variant for coated finishes (e.g. "Ivory w/ red
  // splutter") — doesn't affect inventory, since stock stays tracked at the
  // finish level (NS/Ceramic), not per color variant. Purely informational.
  variant_note: text("variant_note"),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const indents = sqliteTable("indents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  month: text("month").notNull(),
  expected_receipts: integer("expected_receipts").notNull().default(0),
  current_safety_stock: integer("current_safety_stock").notNull().default(0),
  // When false (default), expected_receipts is auto-derived from open purchase
  // orders (quantity_ordered - quantity_received) rather than typed by hand.
  // Set true only when someone explicitly overrides the auto value.
  is_manual_expected_receipts: integer("is_manual_expected_receipts", { mode: "boolean" }).notNull().default(false),
});

export const insertIndentSchema = createInsertSchema(indents).omit({
  id: true,
});

export type InsertIndent = z.infer<typeof insertIndentSchema>;
export type Indent = typeof indents.$inferSelect;

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  caster_id: integer("caster_id").references(() => casters.id),
  batch_number: text("batch_number").notNull().unique(),
  received_date: text("received_date").notNull(),
  quantity_received: integer("quantity_received").notNull().default(0),
  quantity_rejected: integer("quantity_rejected").notNull().default(0),
  quantity_produced: integer("quantity_produced").notNull(),
  quantity_remaining: integer("quantity_remaining").notNull(),
  is_manual_quantity: integer("is_manual_quantity", { mode: "boolean" }).notNull().default(false),
  quality_status: text("quality_status").notNull().default("Good"),
  purchase_order_id: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  // Color/pattern for a coated batch (e.g. "Black", "Ivory") — set when a
  // batch comes out of a coating conversion. Metadata only, doesn't split
  // stock into separate pools (bare/NS/CER stays the only real split).
  color: text("color"),
  notes: text("notes"),
  is_depleted: integer("is_depleted", { mode: "boolean" }).notNull().default(false),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
});

export const updateBatchSchema = z.object({
  batch_number: z.string().min(1).optional(),
  caster_id: z.preprocess(
    (val) => val === undefined || val === "" || val === null ? undefined : typeof val === "string" ? parseInt(val, 10) : val,
    z.number().int().min(1).optional().nullable()
  ),
  received_date: z.string().min(1).optional(),
  quantity_received: z.preprocess(
    (val) => val === undefined || val === "" ? undefined : typeof val === "string" ? parseInt(val, 10) : val,
    z.number().int().min(0).optional()
  ),
  quantity_rejected: z.preprocess(
    (val) => val === undefined || val === "" ? undefined : typeof val === "string" ? parseInt(val, 10) : val,
    z.number().int().min(0).optional()
  ),
  quantity_produced: z.preprocess(
    (val) => val === undefined || val === "" ? undefined : typeof val === "string" ? parseInt(val, 10) : val,
    z.number().int().min(0).optional()
  ),
  is_manual_quantity: z.boolean().optional(),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]).optional(),
  color: z.string().nullable().optional(),
  notes: z.string().optional(),
}).refine(data => {
  // Count fields that are actually provided (not undefined)
  const providedFields = Object.values(data).filter(val => val !== undefined).length;
  return providedFields > 0;
}, {
  message: "At least one field must be provided for update"
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type UpdateBatch = z.infer<typeof updateBatchSchema>;
export type Batch = typeof batches.$inferSelect;

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  invoice_number: text("invoice_number").notNull(),
  invoice_date: text("invoice_date"),
  notes: text("notes"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const shipments = sqliteTable("shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  order_item_id: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  shipment_number: text("shipment_number"),
  batch_number: text("batch_number"),
  quantity_shipped: integer("quantity_shipped").notNull(),
  shipment_date: text("shipment_date").notNull(),
  invoice_id: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;

export const accessories = sqliteTable("accessories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku"),
  stock_on_hand: integer("stock_on_hand").notNull().default(0),
  safety_stock: integer("safety_stock").notNull().default(0),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
});

export const insertAccessorySchema = createInsertSchema(accessories).omit({
  id: true,
});

export type InsertAccessory = z.infer<typeof insertAccessorySchema>;
export type Accessory = typeof accessories.$inferSelect;

// "casters" is the underlying table name for historical reasons, but it now
// represents any vendor Onyx sends work or material to: casters, handle
// mould-holders, coaters, packers, material suppliers (e.g. IB sheet). The
// vendor_type field is what actually distinguishes them.
export const casters = sqliteTable("casters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // 'caster' | 'handle_vendor' | 'coater' | 'packer' | 'material_supplier' | 'other'
  vendor_type: text("vendor_type").notNull().default("caster"),
  address: text("address"),
  contact_person: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  lead_time_days: integer("lead_time_days"),
  payment_terms: text("payment_terms"),
  status: text("status").notNull().default("active"),
  // Default wastage % for this vendor, by material type. Null falls back to
  // the company-wide defaults (6% ingot / 8% scrap) applied in code. Can be
  // further overridden per-SKU in sku_wastage_overrides.
  default_wastage_ingot_pct: real("default_wastage_ingot_pct"),
  default_wastage_scrap_pct: real("default_wastage_scrap_pct"),
  notes: text("notes"),
});

export const insertCasterSchema = createInsertSchema(casters).omit({
  id: true,
});

export type InsertCaster = z.infer<typeof insertCasterSchema>;
export type Caster = typeof casters.$inferSelect;

// Per-SKU wastage override for a specific vendor. Only present when it
// differs from that vendor's material-type default. material_type null means
// the override applies to both ingot and scrap for that SKU+vendor.
export const skuWastageOverrides = sqliteTable("sku_wastage_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id, { onDelete: "cascade" }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  material_type: text("material_type"), // 'ingot' | 'scrap' | null (applies to both)
  wastage_pct: real("wastage_pct").notNull(),
  notes: text("notes"),
});

export const insertSkuWastageOverrideSchema = createInsertSchema(skuWastageOverrides).omit({
  id: true,
});

export type InsertSkuWastageOverride = z.infer<typeof insertSkuWastageOverrideSchema>;
export type SkuWastageOverride = typeof skuWastageOverrides.$inferSelect;

// Dies/moulds Onyx has invested in, physically held at a vendor's premises.
// Covers both casting dies (at casters) and handle moulds (at handle vendors).
export const dies = sqliteTable("dies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  mould_type: text("mould_type").notNull().default("casting"), // 'casting' | 'handle'
  shot_count: integer("shot_count").notNull().default(0),
  last_rework_date: text("last_rework_date"),
  status: text("status").notNull().default("active"), // 'active' | 'retired'
  notes: text("notes"),
});

export const insertDieSchema = createInsertSchema(dies).omit({
  id: true,
});

export type InsertDie = z.infer<typeof insertDieSchema>;
export type Die = typeof dies.$inferSelect;

// Rework agreement: a defective batch (blowholes etc.) is sent back to a
// vendor and swapped 1:1 for good pieces. This does NOT touch the main
// ingot/scrap metal balance — the vendor absorbs it (they remelt the
// defective piece's own metal). Tracked separately for visibility only.
export const reworks = sqliteTable("reworks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  original_batch_id: integer("original_batch_id").references(() => batches.id, { onDelete: "set null" }),
  quantity_defective: integer("quantity_defective").notNull(),
  sent_date: text("sent_date").notNull(),
  quantity_replaced: integer("quantity_replaced").notNull().default(0),
  replacement_batch_id: integer("replacement_batch_id").references(() => batches.id, { onDelete: "set null" }),
  replacement_received_date: text("replacement_received_date"),
  status: text("status").notNull().default("pending"), // 'pending' | 'partial' | 'received'
  notes: text("notes"),
});

export const insertReworkSchema = createInsertSchema(reworks).omit({
  id: true,
});

export type InsertRework = z.infer<typeof insertReworkSchema>;
export type Rework = typeof reworks.$inferSelect;

// Monthly statement of the running metal balance for a vendor, sent for
// acknowledgement. Holds both Onyx's calculated figures and (when the vendor
// sends their own report) the vendor-reported figures side by side, so they
// can be compared rather than just trusting one side.
export const vendorMetalStatements = sqliteTable("vendor_metal_statements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  period_month: text("period_month").notNull(), // 'YYYY-MM'
  opening_balance_kg: real("opening_balance_kg").notNull().default(0),
  dispatched_kg: real("dispatched_kg").notNull().default(0),
  expected_received_kg: real("expected_received_kg").notNull().default(0),
  actual_received_kg: real("actual_received_kg").notNull().default(0),
  closing_balance_kg: real("closing_balance_kg").notNull().default(0),
  vendor_reported_produced_kg: real("vendor_reported_produced_kg"),
  vendor_reported_received_kg: real("vendor_reported_received_kg"),
  vendor_reported_remaining_kg: real("vendor_reported_remaining_kg"),
  status: text("status").notNull().default("draft"), // 'draft' | 'sent' | 'acknowledged'
  sent_date: text("sent_date"),
  ack_date: text("ack_date"),
  notes: text("notes"),
});

export const insertVendorMetalStatementSchema = createInsertSchema(vendorMetalStatements).omit({
  id: true,
});

export type InsertVendorMetalStatement = z.infer<typeof insertVendorMetalStatementSchema>;
export type VendorMetalStatement = typeof vendorMetalStatements.$inferSelect;

// BOM: what a kit item (is_kit = true) actually contains. component_type
// distinguishes a cast/tracked item (fry pan) from an accessory (handle,
// glass lid, IB sheet). Fully data-driven — new combos are just new rows.
export const bomComponents = sqliteTable("bom_components", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parent_item_id: integer("parent_item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  component_type: text("component_type").notNull(), // 'item' | 'accessory'
  component_item_id: integer("component_item_id").references(() => items.id),
  component_accessory_id: integer("component_accessory_id").references(() => accessories.id),
  qty_per_kit: integer("qty_per_kit").notNull().default(1),
});

export const insertBomComponentSchema = createInsertSchema(bomComponents).omit({
  id: true,
});

export type InsertBomComponent = z.infer<typeof insertBomComponentSchema>;
export type BomComponent = typeof bomComponents.$inferSelect;

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  po_number: text("po_number").notNull().unique(),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  order_date: text("order_date").notNull(),
  expected_delivery_date: text("expected_delivery_date"),
  status: text("status").notNull().default("confirmed"),
  notes: text("notes"),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchase_order_id: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  quantity_ordered: integer("quantity_ordered").notNull(),
  quantity_received: integer("quantity_received").notNull().default(0),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
});

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Tracks aluminium material sent from Onyx to a caster — either fresh ingot
// or scrap (both get remelted by the caster). This is the other half of the
// material loop that batches.quantity_received closes — comparing metal sent
// against finished casting weight/piece-count lets you catch abnormal melt
// loss or under-delivery from a vendor early, matching how the accountant
// already does this by hand (avg weight per SKU -> expected piece count).
export const ingotDispatches = sqliteTable("ingot_dispatches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  dispatch_date: text("dispatch_date").notNull(),
  material_type: text("material_type").notNull().default("ingot"), // 'ingot' | 'scrap' | 'rework'
  alloy_grade: text("alloy_grade"),
  quantity_kg: real("quantity_kg").notNull(),
  purchase_order_id: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  notes: text("notes"),
});

export const insertIngotDispatchSchema = createInsertSchema(ingotDispatches).omit({
  id: true,
});

export type InsertIngotDispatch = z.infer<typeof insertIngotDispatchSchema>;
export type IngotDispatch = typeof ingotDispatches.$inferSelect;

// Generic key-value store for app-wide configuration (e.g. default wastage
// rates, and later things like a current metal rate for quotations). Using
// key-value rather than dedicated columns means adding a new setting later
// is just a new row, not a schema migration.
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at"),
});

export const insertAppSettingSchema = createInsertSchema(appSettings);

export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;

// Well-known setting keys, so callers don't hand-type strings
export const SETTINGS_KEYS = {
  DEFAULT_WASTAGE_INGOT_PCT: "default_wastage_ingot_pct",
  DEFAULT_WASTAGE_SCRAP_PCT: "default_wastage_scrap_pct",
} as const;

// Records exactly which batch(es) or accessory a kit shipment drew from —
// the missing piece that makes kit shipments reversible (edit/delete), same
// as normal single-batch shipments already are. Without this, we'd know a
// kit shipment happened but not precisely what to undo.
export const kitShipmentAllocations = sqliteTable("kit_shipment_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shipment_id: integer("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  component_type: text("component_type").notNull(), // 'item' | 'accessory'
  component_item_id: integer("component_item_id").references(() => items.id),
  component_accessory_id: integer("component_accessory_id").references(() => accessories.id),
  batch_id: integer("batch_id").references(() => batches.id), // set for item-type allocations only
  quantity: integer("quantity").notNull(),
});

export const insertKitShipmentAllocationSchema = createInsertSchema(kitShipmentAllocations).omit({
  id: true,
});

export type InsertKitShipmentAllocation = z.infer<typeof insertKitShipmentAllocationSchema>;
export type KitShipmentAllocation = typeof kitShipmentAllocations.$inferSelect;

// Accessories ordered directly on an order — NOT as part of a kit's BOM, but
// as their own line (e.g. a bare casting order that also needs loose handles
// or extra knobs). Kept as a fully separate table from order_items rather
// than making item_id nullable there, since order_items.item_id is relied
// on (NOT NULL) throughout Dashboard/Indent/shipment logic — this keeps
// those completely untouched and adds the new capability purely additively.
export const orderAccessoryItems = sqliteTable("order_accessory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  accessory_id: integer("accessory_id")
    .notNull()
    .references(() => accessories.id),
  quantity: integer("quantity").notNull(),
});

export const insertOrderAccessoryItemSchema = createInsertSchema(orderAccessoryItems).omit({
  id: true,
});

export type InsertOrderAccessoryItem = z.infer<typeof insertOrderAccessoryItemSchema>;
export type OrderAccessoryItem = typeof orderAccessoryItems.$inferSelect;

// Shipment record for an accessory ordered directly on an order (see
// order_accessory_items above). Deducts straight from accessories.stock_on_hand
// on create, restores it on delete — same reversible pattern as normal shipments.
export const orderAccessoryShipments = sqliteTable("order_accessory_shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  order_accessory_item_id: integer("order_accessory_item_id")
    .notNull()
    .references(() => orderAccessoryItems.id, { onDelete: "cascade" }),
  accessory_id: integer("accessory_id")
    .notNull()
    .references(() => accessories.id),
  quantity_shipped: integer("quantity_shipped").notNull(),
  shipment_date: text("shipment_date").notNull(),
});

export const insertOrderAccessoryShipmentSchema = createInsertSchema(orderAccessoryShipments).omit({
  id: true,
});

export type InsertOrderAccessoryShipment = z.infer<typeof insertOrderAccessoryShipmentSchema>;
export type OrderAccessoryShipment = typeof orderAccessoryShipments.$inferSelect;

// Monthly projections — a plain, manually-entered "how many pieces do we
// expect to need next month" number per item, given to casters for planning.
// Deliberately NOT derived from orders/stock like Indent's numbers — this is
// a judgment call (can include unconfirmed/potential demand) that sits
// alongside Indent's calculated figure for comparison, not instead of it.
export const projections = sqliteTable("projections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  // Which customer this projection is for — dad's real input is always
  // per-customer ("Kreme wants X of Tawa"), not a single company-wide
  // number. Nullable only for safety with any pre-existing generic rows;
  // every new entry goes through the customer-specific flow.
  customer_id: integer("customer_id").references(() => customers.id),
  month: text("month").notNull(), // 'YYYY-MM'
  quantity: integer("quantity").notNull().default(0),
  notes: text("notes"),
});

export const insertProjectionSchema = createInsertSchema(projections).omit({
  id: true,
});

export type InsertProjection = z.infer<typeof insertProjectionSchema>;
export type Projection = typeof projections.$inferSelect;

// Manual allocation of an item's total monthly projection across the
// caster(s) who hold its casting die — e.g. Tawa's 8000-unit projection
// might split 5000 to Aruna and 3000 to Rheo. Defaults to an even split
// across die-holders when nothing's been manually set yet; this table only
// gets a row once someone actually overrides that default.
export const metalAllocations = sqliteTable("metal_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id),
  caster_id: integer("caster_id")
    .notNull()
    .references(() => casters.id),
  month: text("month").notNull(), // 'YYYY-MM'
  quantity: integer("quantity").notNull().default(0),
});

export const insertMetalAllocationSchema = createInsertSchema(metalAllocations).omit({
  id: true,
});

export type InsertMetalAllocation = z.infer<typeof insertMetalAllocationSchema>;
export type MetalAllocation = typeof metalAllocations.$inferSelect;

// Coating conversion: bare castings sent out for coating, coated pieces come
// back (some rejected at Onyx's own QC on the way back — separate from the
// caster's original QC). Deducts from bare item's batches on send (FIFO,
// tracked per-batch via coating_conversion_allocations for reversibility,
// same pattern as kit shipments); creates a new batch for the coated item on
// receive. Whether this is paper-trailed as a Delivery Chalan or a Sale
// Invoice on the accounting side doesn't matter here — physically it's the
// same movement either way, tracked once.
export const coatingConversions = sqliteTable("coating_conversions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bare_item_id: integer("bare_item_id")
    .notNull()
    .references(() => items.id),
  coated_item_id: integer("coated_item_id")
    .notNull()
    .references(() => items.id),
  caster_id: integer("caster_id").references(() => casters.id), // the coater vendor, optional
  quantity_sent: integer("quantity_sent").notNull(),
  sent_date: text("sent_date").notNull(),
  color: text("color"),
  quantity_received: integer("quantity_received"), // null until received
  quantity_rejected: integer("quantity_rejected"),
  received_date: text("received_date"),
  output_batch_id: integer("output_batch_id").references(() => batches.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'received'
  notes: text("notes"),
});

export const insertCoatingConversionSchema = createInsertSchema(coatingConversions).omit({
  id: true,
});

export type InsertCoatingConversion = z.infer<typeof insertCoatingConversionSchema>;
export type CoatingConversion = typeof coatingConversions.$inferSelect;

// Records exactly which bare batch(es) a coating conversion drew from, so it
// can be precisely reversed on delete — same reasoning as kit_shipment_allocations.
export const coatingConversionAllocations = sqliteTable("coating_conversion_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  coating_conversion_id: integer("coating_conversion_id")
    .notNull()
    .references(() => coatingConversions.id, { onDelete: "cascade" }),
  batch_id: integer("batch_id")
    .notNull()
    .references(() => batches.id),
  quantity: integer("quantity").notNull(),
});

export const insertCoatingConversionAllocationSchema = createInsertSchema(coatingConversionAllocations).omit({
  id: true,
});

export type InsertCoatingConversionAllocation = z.infer<typeof insertCoatingConversionAllocationSchema>;
export type CoatingConversionAllocation = typeof coatingConversionAllocations.$inferSelect;

// Which accessories a finished item requires per unit shipped — e.g. "NS
// Tawa, Black" needs 1 dark wood long handle; "NS Kadai, Ivory" needs 2
// light-colored side handles. Optionally color-specific (a batch's color
// decides which requirement set applies); a null color is a fallback that
// applies regardless of color, for items where color doesn't change the
// accessory. Deliberately separate from BOM components, which are kit-only
// — this is for accessories that go out with a STANDALONE (non-kit) shipped
// item, not something assembled into a combo pack.
export const itemAccessoryRequirements = sqliteTable("item_accessory_requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  item_id: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  color: text("color"), // null = applies regardless of color
  accessory_id: integer("accessory_id")
    .notNull()
    .references(() => accessories.id),
  quantity_per_unit: integer("quantity_per_unit").notNull().default(1),
});

export const insertItemAccessoryRequirementSchema = createInsertSchema(itemAccessoryRequirements).omit({
  id: true,
});

export type InsertItemAccessoryRequirement = z.infer<typeof insertItemAccessoryRequirementSchema>;
export type ItemAccessoryRequirement = typeof itemAccessoryRequirements.$inferSelect;

// Tracks exactly which accessories (and how much) were auto-deducted for a
// given shipment, so it's precisely reversible on delete — same reasoning
// as kit_shipment_allocations and coating_conversion_allocations.
export const shipmentAccessoryAllocations = sqliteTable("shipment_accessory_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shipment_id: integer("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  accessory_id: integer("accessory_id")
    .notNull()
    .references(() => accessories.id),
  quantity: integer("quantity").notNull(),
});

export const insertShipmentAccessoryAllocationSchema = createInsertSchema(shipmentAccessoryAllocations).omit({
  id: true,
});

export type InsertShipmentAccessoryAllocation = z.infer<typeof insertShipmentAccessoryAllocationSchema>;
export type ShipmentAccessoryAllocation = typeof shipmentAccessoryAllocations.$inferSelect;

// Tracks exactly which accessories were auto-deducted when bare castings
// were sent for coating (e.g. IB circles, already fixed in-house before the
// castings leave — whether they leave to an OEM customer via a Shipment, or
// to a coater via a Coating Conversion). Kept as its own table, mirroring
// shipment_accessory_allocations, since a coating conversion isn't a
// Shipment record at all.
export const coatingConversionAccessoryAllocations = sqliteTable("coating_conversion_accessory_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  coating_conversion_id: integer("coating_conversion_id")
    .notNull()
    .references(() => coatingConversions.id, { onDelete: "cascade" }),
  accessory_id: integer("accessory_id")
    .notNull()
    .references(() => accessories.id),
  quantity: integer("quantity").notNull(),
});

export const insertCoatingConversionAccessoryAllocationSchema = createInsertSchema(coatingConversionAccessoryAllocations).omit({
  id: true,
});

export type InsertCoatingConversionAccessoryAllocation = z.infer<typeof insertCoatingConversionAccessoryAllocationSchema>;
export type CoatingConversionAccessoryAllocation = typeof coatingConversionAccessoryAllocations.$inferSelect;
