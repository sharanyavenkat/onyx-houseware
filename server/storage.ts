import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { 
  type User, 
  type InsertUser,
  type Item,
  type InsertItem,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Indent,
  type InsertIndent,
  type Shipment,
  type InsertShipment,
  users,
  items,
  customers,
  orders,
  orderItems,
  indents,
  shipments
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllItems(): Promise<Item[]>;
  getItemById(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;
  getCustomerById(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;

  getAllOrders(): Promise<Order[]>;
  getOrderById(id: number): Promise<Order | undefined>;
  getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;
  deleteOrderItems(orderId: number): Promise<void>;

  getIndentsByMonth(month: string): Promise<Indent[]>;
  upsertIndent(indent: InsertIndent): Promise<Indent>;

  getShipmentsByOrderId(orderId: number): Promise<Shipment[]>;
  getShipmentsByOrderItemId(orderItemId: number): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<InsertShipment>): Promise<Shipment | undefined>;
  deleteShipment(id: number): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async getItemById(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async updateItem(id: number, updateData: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items).set(updateData).where(eq(items.id, id)).returning();
    return item;
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, updateData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return customer;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.order_id, orderId));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const [orderItem] = await db.insert(orderItems).values(insertOrderItem).returning();
    return orderItem;
  }

  async updateOrder(id: number, updateData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return order;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  async deleteOrderItems(orderId: number): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.order_id, orderId));
  }

  async getIndentsByMonth(month: string): Promise<Indent[]> {
    return await db.select().from(indents).where(eq(indents.month, month));
  }

  async upsertIndent(insertIndent: InsertIndent): Promise<Indent> {
    // Check if indent already exists for this item and month
    const [existing] = await db.select().from(indents).where(
      and(
        eq(indents.item_id, insertIndent.item_id),
        eq(indents.month, insertIndent.month)
      )
    );

    if (existing) {
      // Update existing indent
      const [updated] = await db.update(indents)
        .set({
          opening_balance: insertIndent.opening_balance,
          expected_receipts: insertIndent.expected_receipts
        })
        .where(eq(indents.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new indent
      const [newIndent] = await db.insert(indents).values(insertIndent).returning();
      return newIndent;
    }
  }

  async getShipmentsByOrderId(orderId: number): Promise<Shipment[]> {
    return await db.select().from(shipments).where(eq(shipments.order_id, orderId));
  }

  async getShipmentsByOrderItemId(orderItemId: number): Promise<Shipment[]> {
    return await db.select().from(shipments).where(eq(shipments.order_item_id, orderItemId));
  }

  async createShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const [shipment] = await db.insert(shipments).values(insertShipment).returning();
    return shipment;
  }

  async updateShipment(id: number, updateData: Partial<InsertShipment>): Promise<Shipment | undefined> {
    const [shipment] = await db.update(shipments).set(updateData).where(eq(shipments.id, id)).returning();
    return shipment;
  }

  async deleteShipment(id: number): Promise<void> {
    await db.delete(shipments).where(eq(shipments.id, id));
  }
}

export const storage = new DbStorage();
