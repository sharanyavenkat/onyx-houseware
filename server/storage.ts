import { eq, and, sql, desc } from "drizzle-orm";
import { db, sqlite } from "./db/client";
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
  type Batch,
  type InsertBatch,
  users,
  items,
  customers,
  orders,
  orderItems,
  indents,
  shipments,
  batches
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

  getAllBatches(): Promise<Batch[]>;
  getBatchesByItemId(itemId: number): Promise<Batch[]>;
  getBatchByNumber(batchNumber: string): Promise<Batch | undefined>;
  getActiveBatchesByItemId(itemId: number): Promise<Batch[]>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  updateBatchMetadata(id: number, updates: { batch_number?: string, received_date?: string, quality_status?: string, notes?: string }): Promise<Batch | undefined>;
  adjustBatchQuantities(batchNumber: string, adjustments: { shipped?: number, rejected?: number }): Promise<Batch>;
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
    console.log('[Storage] upsertIndent called with:', JSON.stringify(insertIndent, null, 2));
    
    // Check if indent already exists for this item and month
    const [existing] = await db.select().from(indents).where(
      and(
        eq(indents.item_id, insertIndent.item_id),
        eq(indents.month, insertIndent.month)
      )
    );

    console.log('[Storage] Existing indent found:', JSON.stringify(existing, null, 2));

    let result: Indent;

    if (existing) {
      // Update existing indent
      console.log('[Storage] Updating with values:', {
        opening_balance: insertIndent.opening_balance,
        expected_receipts: insertIndent.expected_receipts,
        current_safety_stock: insertIndent.current_safety_stock
      });
      
      const [updated] = await db.update(indents)
        .set({
          opening_balance: insertIndent.opening_balance,
          expected_receipts: insertIndent.expected_receipts,
          current_safety_stock: insertIndent.current_safety_stock
        })
        .where(eq(indents.id, existing.id))
        .returning();
      
      console.log('[Storage] After update, returned:', JSON.stringify(updated, null, 2));
      result = updated;
    } else {
      // Create new indent
      console.log('[Storage] Creating new indent');
      const [newIndent] = await db.insert(indents).values(insertIndent).returning();
      console.log('[Storage] After insert, returned:', JSON.stringify(newIndent, null, 2));
      result = newIndent;
    }

    // Force WAL checkpoint to ensure changes are written to disk
    // This is necessary because testing agents may query from a different connection
    sqlite.pragma("wal_checkpoint(FULL)");
    console.log('[Storage] WAL checkpoint executed');
    
    // Verify what's actually in the DB after checkpoint
    const [verified] = await db.select().from(indents).where(eq(indents.id, result.id));
    console.log('[Storage] Verification query result after checkpoint:', JSON.stringify(verified, null, 2));
    
    return result;
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

  async getAllBatches(): Promise<Batch[]> {
    return await db.select().from(batches).orderBy(desc(batches.received_date));
  }

  async getBatchesByItemId(itemId: number): Promise<Batch[]> {
    return await db.select().from(batches)
      .where(eq(batches.item_id, itemId))
      .orderBy(desc(batches.received_date));
  }

  async getBatchByNumber(batchNumber: string): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.batch_number, batchNumber));
    return batch;
  }

  async getActiveBatchesByItemId(itemId: number): Promise<Batch[]> {
    return await db.select().from(batches)
      .where(
        and(
          eq(batches.item_id, itemId),
          eq(batches.is_depleted, false)
        )
      )
      .orderBy(desc(batches.received_date));
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const [batch] = await db.insert(batches).values(insertBatch).returning();
    return batch;
  }

  async updateBatchMetadata(id: number, updates: { batch_number?: string, received_date?: string, quality_status?: string, notes?: string }): Promise<Batch | undefined> {
    // Only allow updating metadata fields, not quantities
    const [batch] = await db.update(batches).set(updates).where(eq(batches.id, id)).returning();
    return batch;
  }

  async adjustBatchQuantities(
    batchNumber: string, 
    adjustments: { shipped?: number, rejected?: number }
  ): Promise<Batch> {
    // Coerce absent values to zero and validate
    const shippedDelta = adjustments.shipped ?? 0;
    const rejectedDelta = adjustments.rejected ?? 0;

    // Input validation: require positive deltas
    if (shippedDelta <= 0 && rejectedDelta <= 0) {
      const error: any = new Error('At least one adjustment (shipped or rejected) must be positive');
      error.code = 'INVALID_ADJUSTMENT';
      throw error;
    }
    if (shippedDelta < 0) {
      const error: any = new Error(`Shipped quantity cannot be negative: ${shippedDelta}`);
      error.code = 'INVALID_ADJUSTMENT';
      throw error;
    }
    if (rejectedDelta < 0) {
      const error: any = new Error(`Rejected quantity cannot be negative: ${rejectedDelta}`);
      error.code = 'INVALID_ADJUSTMENT';
      throw error;
    }

    return await db.transaction(async (tx) => {
      // Lock the row and get current state using transaction handle
      const [batch] = await tx.select().from(batches)
        .where(eq(batches.batch_number, batchNumber));

      if (!batch) {
        const error: any = new Error(`Batch ${batchNumber} not found`);
        error.code = 'BATCH_NOT_FOUND';
        throw error;
      }

      // Calculate total shipped from current state: produced - remaining - rejected
      const currentShipped = batch.quantity_produced - batch.quantity_remaining - batch.quantity_rejected;
      
      // Validate that existing data doesn't violate invariants (catches bad historical data)
      if (currentShipped < 0) {
        const error: any = new Error(
          `Batch ${batchNumber} has invalid historical data (shipped cannot be negative). ` +
          `Produced: ${batch.quantity_produced}, ` +
          `Remaining: ${batch.quantity_remaining}, ` +
          `Rejected: ${batch.quantity_rejected}, ` +
          `Derived shipped: ${currentShipped}`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Apply adjustments to get new totals
      const totalShipped = currentShipped + shippedDelta;
      const totalRejected = batch.quantity_rejected + rejectedDelta;

      // Validate sufficient quantity for this adjustment
      const requiredQuantity = shippedDelta + rejectedDelta;
      if (batch.quantity_remaining < requiredQuantity) {
        const error: any = new Error(
          `Insufficient quantity in batch ${batchNumber}. ` +
          `Requested: ${requiredQuantity} (${shippedDelta} shipped + ${rejectedDelta} rejected), ` +
          `Available: ${batch.quantity_remaining}`
        );
        error.code = 'INSUFFICIENT_QUANTITY';
        throw error;
      }

      // Recompute remaining using canonical invariant: remaining = produced - shipped - rejected
      const newRemaining = batch.quantity_produced - totalShipped - totalRejected;

      // Enforce non-negative invariant
      if (newRemaining < 0) {
        const error: any = new Error(
          `Batch ${batchNumber} adjustment violated invariant (remaining cannot be negative). ` +
          `Produced: ${batch.quantity_produced}, ` +
          `Total shipped: ${totalShipped}, ` +
          `Total rejected: ${totalRejected}, ` +
          `Calculated remaining: ${newRemaining}`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Validate that remaining doesn't exceed produced (catches over-counting)
      if (newRemaining > batch.quantity_produced) {
        const error: any = new Error(
          `Batch ${batchNumber} adjustment violated invariant (remaining cannot exceed produced). ` +
          `Produced: ${batch.quantity_produced}, ` +
          `Calculated remaining: ${newRemaining}, ` +
          `Total shipped: ${totalShipped}, ` +
          `Total rejected: ${totalRejected}`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Validate canonical relationship: produced >= shipped + rejected
      if (batch.quantity_produced < totalShipped + totalRejected) {
        const error: any = new Error(
          `Batch ${batchNumber} adjustment violated invariant (produced must be >= shipped + rejected). ` +
          `Produced: ${batch.quantity_produced}, ` +
          `Total shipped: ${totalShipped}, ` +
          `Total rejected: ${totalRejected}`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Update batch with new calculated values and auto-compute depleted flag
      const [updated] = await tx.update(batches)
        .set({
          quantity_remaining: newRemaining,
          quantity_rejected: totalRejected,
          is_depleted: newRemaining === 0
        })
        .where(eq(batches.batch_number, batchNumber))
        .returning();

      return updated;
    });
  }
}

export const storage = new DbStorage();
