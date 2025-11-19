import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
  product_type: text("product_type").notNull(),
  size_specification: text("size_specification").notNull(),
  price: real("price").notNull(),
  desired_safety_stock: integer("desired_safety_stock").notNull().default(0),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
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
  opening_balance: integer("opening_balance").notNull().default(0),
  expected_receipts: integer("expected_receipts").notNull().default(0),
  current_safety_stock: integer("current_safety_stock").notNull().default(0),
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
  batch_number: text("batch_number").notNull().unique(),
  received_date: text("received_date").notNull(),
  quantity_produced: integer("quantity_produced").notNull(),
  quantity_remaining: integer("quantity_remaining").notNull(),
  quantity_rejected: integer("quantity_rejected").notNull().default(0),
  quality_status: text("quality_status").notNull().default("Good"),
  notes: text("notes"),
  is_depleted: integer("is_depleted", { mode: "boolean" }).notNull().default(false),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
});

export const updateBatchSchema = z.object({
  batch_number: z.string().min(1).optional(),
  received_date: z.string().min(1).optional(),
  quantity_produced: z.preprocess(
    (val) => val === undefined || val === "" ? undefined : typeof val === "string" ? parseInt(val, 10) : val,
    z.number().int().min(1).optional()
  ),
  quality_status: z.enum(["Good", "Acceptable", "Rejected"]).optional(),
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

export const shipments = sqliteTable("shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  order_id: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  order_item_id: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  batch_number: text("batch_number"),
  quantity_shipped: integer("quantity_shipped").notNull(),
  rejections_blowholes: integer("rejections_blowholes").notNull().default(0),
  rejections_handles: integer("rejections_handles").notNull().default(0),
  rejections_other: integer("rejections_other").notNull().default(0),
  shipment_date: text("shipment_date").notNull(),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;
