import { relations } from "drizzle-orm/relations";
import { customers, orders, items, orderItems, indents, shipments } from "./schema";

export const ordersRelations = relations(orders, ({one, many}) => ({
	customer: one(customers, {
		fields: [orders.customerId],
		references: [customers.id]
	}),
	orderItems: many(orderItems),
	shipments: many(shipments),
}));

export const customersRelations = relations(customers, ({many}) => ({
	orders: many(orders),
}));

export const orderItemsRelations = relations(orderItems, ({one, many}) => ({
	item: one(items, {
		fields: [orderItems.itemId],
		references: [items.id]
	}),
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	shipments: many(shipments),
}));

export const itemsRelations = relations(items, ({many}) => ({
	orderItems: many(orderItems),
	indents: many(indents),
}));

export const indentsRelations = relations(indents, ({one}) => ({
	item: one(items, {
		fields: [indents.itemId],
		references: [items.id]
	}),
}));

export const shipmentsRelations = relations(shipments, ({one}) => ({
	orderItem: one(orderItems, {
		fields: [shipments.orderItemId],
		references: [orderItems.id]
	}),
	order: one(orders, {
		fields: [shipments.orderId],
		references: [orders.id]
	}),
}));