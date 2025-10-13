import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  product_type: text("product_type").notNull(),
  size_specification: text("size_specification").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  safety_stock: integer("safety_stock").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  company_name: text("company_name").notNull(),
  contact_person: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  po_number: text("po_number").notNull().unique(),
  customer_id: integer("customer_id").notNull().references(() => customers.id),
  order_date: date("order_date").notNull(),
  fulfillment_date: date("fulfillment_date"),
  status: text("status").notNull().default("draft"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  item_id: integer("item_id").notNull().references(() => items.id),
  quantity: integer("quantity").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const indents = pgTable("indents", {
  id: serial("id").primaryKey(),
  item_id: integer("item_id").notNull().references(() => items.id),
  month: text("month").notNull(),
  opening_balance: integer("opening_balance").notNull().default(0),
  expected_receipts: integer("expected_receipts").notNull().default(0),
});

export const insertIndentSchema = createInsertSchema(indents).omit({
  id: true,
});

export type InsertIndent = z.infer<typeof insertIndentSchema>;
export type Indent = typeof indents.$inferSelect;

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  order_item_id: integer("order_item_id").notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  lot_number: text("lot_number").notNull(),
  quantity_shipped: integer("quantity_shipped").notNull(),
  rejections_blowholes: integer("rejections_blowholes").notNull().default(0),
  rejections_handles: integer("rejections_handles").notNull().default(0),
  rejections_other: integer("rejections_other").notNull().default(0),
  shipment_date: date("shipment_date").notNull(),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;
