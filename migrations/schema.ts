import { sqliteTable, AnySQLiteColumn, text, integer, real, foreignKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const users = sqliteTable("users", {
	id: text().primaryKey(),
	username: text().notNull(),
	password: text().notNull(),
});

export const items = sqliteTable("items", {
	id: integer().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	sku: text().notNull(),
	productType: text("product_type").notNull(),
	sizeSpecification: text("size_specification").notNull(),
	price: real().notNull(),
	safetyStock: integer("safety_stock").default(0).notNull(),
	isActive: integer("is_active").default(1).notNull(),
});

export const customers = sqliteTable("customers", {
	id: integer().primaryKey({ autoIncrement: true }),
	companyName: text("company_name").notNull(),
	contactPerson: text("contact_person"),
	phone: text(),
	email: text(),
	address: text(),
});

export const orders = sqliteTable("orders", {
	id: integer().primaryKey({ autoIncrement: true }),
	poNumber: text("po_number").notNull(),
	customerId: integer("customer_id").notNull().references(() => customers.id),
	orderDate: text("order_date").notNull(),
	fulfillmentDate: text("fulfillment_date"),
	status: text().default("draft").notNull(),
});

export const orderItems = sqliteTable("order_items", {
	id: integer().primaryKey({ autoIncrement: true }),
	orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" } ),
	itemId: integer("item_id").notNull().references(() => items.id),
	quantity: integer().notNull(),
});

export const indents = sqliteTable("indents", {
	id: integer().primaryKey({ autoIncrement: true }),
	itemId: integer("item_id").notNull().references(() => items.id),
	month: text().notNull(),
	openingBalance: integer("opening_balance").default(0).notNull(),
	expectedReceipts: integer("expected_receipts").default(0).notNull(),
});

export const shipments = sqliteTable("shipments", {
	id: integer().primaryKey({ autoIncrement: true }),
	orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" } ),
	orderItemId: integer("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" } ),
	lotNumber: text("lot_number"),
	quantityShipped: integer("quantity_shipped").notNull(),
	rejectionsBlowholes: integer("rejections_blowholes").default(0).notNull(),
	rejectionsHandles: integer("rejections_handles").default(0).notNull(),
	rejectionsOther: integer("rejections_other").default(0).notNull(),
	shipmentDate: text("shipment_date").notNull(),
});

