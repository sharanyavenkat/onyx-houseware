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
  getItemReferences(id: number): Promise<{ orderItems: number; batches: number; indents: number }>;
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
  deleteIndentsByItemId(itemId: number): Promise<void>;

  getShipmentsByOrderId(orderId: number): Promise<Shipment[]>;
  getShipmentsByOrderItemId(orderItemId: number): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<InsertShipment>): Promise<Shipment | undefined>;
  deleteShipment(id: number): Promise<void>;

  getAllBatches(): Promise<Batch[]>;
  getBatchById(id: number): Promise<Batch | undefined>;
  getBatchesByItemId(itemId: number): Promise<Batch[]>;
  getBatchByNumber(batchNumber: string): Promise<Batch | undefined>;
  getActiveBatchesByItemId(itemId: number): Promise<Batch[]>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  updateBatch(id: number, updates: { batch_number?: string, received_date?: string, quantity_produced?: number, quantity_rejected?: number, quality_status?: string, notes?: string }): Promise<Batch>;
  updateBatchMetadata(id: number, updates: { batch_number?: string, received_date?: string, quantity_produced?: number, quality_status?: string, notes?: string }): Promise<Batch | undefined>;
  deleteBatch(id: number): Promise<void>;
  updateBatchRejection(id: number, newRejected: number, quality_status?: string, notes?: string): Promise<Batch>;
  adjustBatchQuantities(batchNumber: string, adjustments: { shipped?: number, rejected?: number }): Promise<Batch>;
  getPendingOrdersByItem(): Promise<Record<number, number>>;
  getOnHandStockByItemWithQuality(includeAcceptable: boolean): Promise<Record<number, number>>;
  getRejectedQuantitiesByItem(): Promise<Record<number, number>>;
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

  async getItemReferences(id: number): Promise<{ orderItems: number; batches: number; indents: number }> {
    const [orderItemsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(orderItems)
      .where(eq(orderItems.item_id, id));
    
    const [batchesResult] = await db.select({ count: sql<number>`count(*)` })
      .from(batches)
      .where(eq(batches.item_id, id));
    
    // Only count indents with non-zero values (zero values are effectively empty)
    const [indentsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(indents)
      .where(
        and(
          eq(indents.item_id, id),
          sql`(expected_receipts > 0 OR current_safety_stock > 0)`
        )
      );
    
    return {
      orderItems: Number(orderItemsResult?.count ?? 0),
      batches: Number(batchesResult?.count ?? 0),
      indents: Number(indentsResult?.count ?? 0),
    };
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async updateItem(id: number, updateData: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items).set(updateData).where(eq(items.id, id)).returning();
    return item;
  }

  async deleteIndentsByItemId(itemId: number): Promise<void> {
    await db.delete(indents).where(eq(indents.item_id, itemId));
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
        expected_receipts: insertIndent.expected_receipts,
        current_safety_stock: insertIndent.current_safety_stock
      });
      
      const [updated] = await db.update(indents)
        .set({
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
    
    // Update batch with new rejection totals (only if batch_number is provided)
    if (shipment.batch_number) {
      const allShipmentsForBatch = await db.select().from(shipments)
        .where(eq(shipments.batch_number, shipment.batch_number));
      
      const totalRejected = allShipmentsForBatch.reduce((sum, s) => {
        return sum + (s.rejections_blowholes || 0) + (s.rejections_handles || 0) + (s.rejections_other || 0);
      }, 0);
      
      const totalShipped = allShipmentsForBatch.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [batch] = await db.select().from(batches).where(eq(batches.batch_number, shipment.batch_number));
      if (batch) {
        const newRemaining = batch.quantity_produced - totalShipped - totalRejected;
        await db.update(batches)
          .set({
            quantity_rejected: totalRejected,
            quantity_remaining: Math.max(0, newRemaining),
            is_depleted: newRemaining <= 0
          })
          .where(eq(batches.batch_number, shipment.batch_number));
      }
    }
    
    return shipment;
  }

  async updateShipment(id: number, updateData: Partial<InsertShipment>): Promise<Shipment | undefined> {
    // Get the OLD shipment before updating to know which batch to recalculate
    const [oldShipment] = await db.select().from(shipments).where(eq(shipments.id, id));
    if (!oldShipment) return undefined;
    
    // Update the shipment
    const [shipment] = await db.update(shipments).set(updateData).where(eq(shipments.id, id)).returning();
    if (!shipment) return undefined;
    
    // Recalculate BOTH batches if batch_number was changed
    const oldBatchNumber = oldShipment.batch_number;
    const newBatchNumber = shipment.batch_number;
    
    // Update the OLD batch (if it existed and is different from new batch)
    if (oldBatchNumber && oldBatchNumber !== newBatchNumber) {
      const oldBatchShipments = await db.select().from(shipments)
        .where(eq(shipments.batch_number, oldBatchNumber));
      
      const oldTotalRejected = oldBatchShipments.reduce((sum, s) => {
        return sum + (s.rejections_blowholes || 0) + (s.rejections_handles || 0) + (s.rejections_other || 0);
      }, 0);
      
      const oldTotalShipped = oldBatchShipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [oldBatch] = await db.select().from(batches).where(eq(batches.batch_number, oldBatchNumber));
      if (oldBatch) {
        const oldNewRemaining = oldBatch.quantity_produced - oldTotalShipped - oldTotalRejected;
        await db.update(batches)
          .set({
            quantity_rejected: oldTotalRejected,
            quantity_remaining: Math.max(0, oldNewRemaining),
            is_depleted: oldNewRemaining <= 0
          })
          .where(eq(batches.batch_number, oldBatchNumber));
      }
    }
    
    // Update the NEW batch (if it exists)
    if (newBatchNumber) {
      const newBatchShipments = await db.select().from(shipments)
        .where(eq(shipments.batch_number, newBatchNumber));
      
      const newTotalRejected = newBatchShipments.reduce((sum, s) => {
        return sum + (s.rejections_blowholes || 0) + (s.rejections_handles || 0) + (s.rejections_other || 0);
      }, 0);
      
      const newTotalShipped = newBatchShipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [newBatch] = await db.select().from(batches).where(eq(batches.batch_number, newBatchNumber));
      if (newBatch) {
        const newNewRemaining = newBatch.quantity_produced - newTotalShipped - newTotalRejected;
        await db.update(batches)
          .set({
            quantity_rejected: newTotalRejected,
            quantity_remaining: Math.max(0, newNewRemaining),
            is_depleted: newNewRemaining <= 0
          })
          .where(eq(batches.batch_number, newBatchNumber));
      }
    }
    
    return shipment;
  }

  async deleteShipment(id: number): Promise<void> {
    // Get shipment before deleting to know which batch to update
    const [shipmentToDelete] = await db.select().from(shipments).where(eq(shipments.id, id));
    if (!shipmentToDelete) return;
    
    const batchNumber = shipmentToDelete.batch_number;
    
    // Delete the shipment
    await db.delete(shipments).where(eq(shipments.id, id));
    
    // Update batch with new rejection totals (only if batch_number exists)
    if (batchNumber) {
      const allShipmentsForBatch = await db.select().from(shipments)
        .where(eq(shipments.batch_number, batchNumber));
      
      const totalRejected = allShipmentsForBatch.reduce((sum, s) => {
        return sum + (s.rejections_blowholes || 0) + (s.rejections_handles || 0) + (s.rejections_other || 0);
      }, 0);
      
      const totalShipped = allShipmentsForBatch.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [batch] = await db.select().from(batches).where(eq(batches.batch_number, batchNumber));
      if (batch) {
        const newRemaining = batch.quantity_produced - totalShipped - totalRejected;
        await db.update(batches)
          .set({
            quantity_rejected: totalRejected,
            quantity_remaining: Math.max(0, newRemaining),
            is_depleted: newRemaining <= 0
          })
          .where(eq(batches.batch_number, batchNumber));
      }
    }
  }

  async getAllBatches(): Promise<Batch[]> {
    return await db.select().from(batches).orderBy(desc(batches.received_date));
  }

  async getBatchById(id: number): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));
    return batch;
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

  async updateBatch(id: number, updates: { batch_number?: string, received_date?: string, quantity_produced?: number, quantity_rejected?: number, quality_status?: string, notes?: string }): Promise<Batch> {
    // Get current batch
    const [currentBatch] = await db.select().from(batches).where(eq(batches.id, id));
    
    if (!currentBatch) {
      const error: any = new Error(`Batch with id ${id} not found`);
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }

    // Build merged batch state with updates applied
    const newBatchNumber = updates.batch_number ?? currentBatch.batch_number;
    const newReceivedDate = updates.received_date ?? currentBatch.received_date;
    const newQualityStatus = updates.quality_status ?? currentBatch.quality_status;
    const newNotes = updates.notes !== undefined ? updates.notes : currentBatch.notes;
    const newProduced = updates.quantity_produced ?? currentBatch.quantity_produced;
    const newRejected = updates.quantity_rejected ?? currentBatch.quantity_rejected;
    
    // Calculate shipped from invariant: shipped = produced - remaining - rejected
    const currentShipped = currentBatch.quantity_produced - currentBatch.quantity_remaining - currentBatch.quantity_rejected;
    
    // Calculate new remaining: remaining = produced - shipped - rejected
    const newRemaining = newProduced - currentShipped - newRejected;
    
    // Validate invariant: produced >= shipped + rejected
    if (newRemaining < 0) {
      const error: any = new Error(
        `Cannot update batch: new produced (${newProduced}) < shipped (${currentShipped}) + rejected (${newRejected})`
      );
      error.code = 'INVARIANT_VIOLATION';
      throw error;
    }

    // Validate rejected quantity doesn't exceed available quantity
    if (newRejected > newProduced - currentShipped) {
      const error: any = new Error(
        `Rejected quantity (${newRejected}) exceeds available quantity (${newProduced - currentShipped})`
      );
      error.code = 'INVALID_REJECTED_QUANTITY';
      throw error;
    }
    
    // Calculate is_depleted flag
    const isDepleted = newRemaining === 0;

    // Update batch with all computed values
    const [updatedBatch] = await db.update(batches)
      .set({
        batch_number: newBatchNumber,
        received_date: newReceivedDate,
        quantity_produced: newProduced,
        quantity_rejected: newRejected,
        quantity_remaining: newRemaining,
        quality_status: newQualityStatus,
        notes: newNotes,
        is_depleted: isDepleted,
      })
      .where(eq(batches.id, id))
      .returning();

    return updatedBatch;
  }

  async updateBatchMetadata(id: number, updates: { batch_number?: string, received_date?: string, quantity_produced?: number, quality_status?: string, notes?: string }): Promise<Batch | undefined> {
    // Get current batch
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));
    
    if (!batch) {
      return undefined;
    }

    // If quantity_produced is being updated, recalculate quantity_remaining
    if (updates.quantity_produced !== undefined) {
      const newProduced = updates.quantity_produced;
      // Calculate shipped from invariant: shipped = produced - remaining - rejected
      const currentShipped = batch.quantity_produced - batch.quantity_remaining - batch.quantity_rejected;
      const newRemaining = newProduced - currentShipped - batch.quantity_rejected;
      
      // Validate that new remaining is non-negative
      if (newRemaining < 0) {
        const error: any = new Error(
          `Cannot update batch: new produced quantity (${newProduced}) is less than shipped (${currentShipped}) + rejected (${batch.quantity_rejected})`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Update with recalculated remaining
      const [updatedBatch] = await db.update(batches)
        .set({
          ...updates,
          quantity_remaining: newRemaining,
          is_depleted: newRemaining === 0,
        })
        .where(eq(batches.id, id))
        .returning();
      
      return updatedBatch;
    } else {
      // No quantity_produced update, just update metadata
      const [updatedBatch] = await db.update(batches).set(updates).where(eq(batches.id, id)).returning();
      return updatedBatch;
    }
  }

  async deleteBatch(id: number): Promise<void> {
    await db.delete(batches).where(eq(batches.id, id));
  }

  async updateBatchRejection(id: number, newRejected: number, quality_status?: string, notes?: string): Promise<Batch> {
    // Validate non-negative rejected quantity
    if (newRejected < 0) {
      const error: any = new Error(`Rejected quantity cannot be negative: ${newRejected}`);
      error.code = 'INVALID_REJECTED_QUANTITY';
      throw error;
    }

    // Get current state
    const [batch] = await db.select().from(batches).where(eq(batches.id, id));

    if (!batch) {
      const error: any = new Error(`Batch ID ${id} not found`);
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }

    // Calculate current shipped quantity: produced - remaining - rejected
    const currentShipped = batch.quantity_produced - batch.quantity_remaining - batch.quantity_rejected;

    // Validate that existing data doesn't violate invariants
    if (currentShipped < 0) {
      const error: any = new Error(
        `Batch ${batch.batch_number} has invalid historical data (shipped cannot be negative). ` +
        `Produced: ${batch.quantity_produced}, ` +
        `Remaining: ${batch.quantity_remaining}, ` +
        `Rejected: ${batch.quantity_rejected}, ` +
        `Derived shipped: ${currentShipped}`
      );
      error.code = 'INVARIANT_VIOLATION';
      throw error;
    }

    // Validate that new rejected quantity doesn't exceed available quantity
    if (newRejected + currentShipped > batch.quantity_produced) {
      const error: any = new Error(
        `Rejected quantity exceeds available quantity in batch ${batch.batch_number}. ` +
        `Produced: ${batch.quantity_produced}, ` +
        `Shipped: ${currentShipped}, ` +
        `New rejected: ${newRejected}, ` +
        `Exceeds by: ${(newRejected + currentShipped) - batch.quantity_produced}`
      );
      error.code = 'INSUFFICIENT_QUANTITY';
      throw error;
    }

    // Recompute remaining using canonical invariant: remaining = produced - shipped - rejected
    const newRemaining = batch.quantity_produced - currentShipped - newRejected;

    // Enforce non-negative invariant (should always pass if previous check passed)
    if (newRemaining < 0) {
      const error: any = new Error(
        `Batch ${batch.batch_number} update violated invariant (remaining cannot be negative). ` +
        `Produced: ${batch.quantity_produced}, ` +
        `Shipped: ${currentShipped}, ` +
        `New rejected: ${newRejected}, ` +
        `Calculated remaining: ${newRemaining}`
      );
      error.code = 'INVARIANT_VIOLATION';
      throw error;
    }

    // Update batch with new rejected quantity and recalculated remaining
    const updates: any = {
      quantity_rejected: newRejected,
      quantity_remaining: newRemaining,
      is_depleted: newRemaining === 0,
    };

    // Optionally update quality_status if provided
    if (quality_status !== undefined) {
      updates.quality_status = quality_status;
    }

    // Optionally update notes if provided
    if (notes !== undefined) {
      updates.notes = notes;
    }

    const [updatedBatch] = await db.update(batches)
      .set(updates)
      .where(eq(batches.id, id))
      .returning();

    return updatedBatch;
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
  async getOnHandStockByItem(): Promise<Record<number, number>> {
    // Calculate on-hand stock as sum of quantity_remaining for all non-depleted batches per item
    const allBatches = await db.select().from(batches);
    
    const onHandStock: Record<number, number> = {};
    
    allBatches.forEach((batch) => {
      if (!batch.is_depleted && batch.quantity_remaining > 0) {
        onHandStock[batch.item_id] = (onHandStock[batch.item_id] || 0) + batch.quantity_remaining;
      }
    });
    
    return onHandStock;
  }

  async getPendingOrdersByItem(): Promise<Record<number, number>> {
    // Get all orders with draft or confirmed status
    const activeOrders = await db.select().from(orders).where(
      sql`${orders.status} IN ('draft', 'confirmed')`
    );
    const activeOrderIds = new Set(activeOrders.map(o => o.id));
    
    if (activeOrderIds.size === 0) {
      return {};
    }
    
    // Get all order items for active orders
    const allOrderItems = await db.select().from(orderItems);
    
    // Get all shipments
    const allShipments = await db.select().from(shipments);
    
    // Calculate shipped quantities and rejected quantities per order item
    const shippedByOrderItem: Record<number, number> = {};
    const rejectedByOrderItem: Record<number, number> = {};
    allShipments.forEach(shipment => {
      shippedByOrderItem[shipment.order_item_id] = 
        (shippedByOrderItem[shipment.order_item_id] || 0) + shipment.quantity_shipped;
      
      const totalRejected = (shipment.rejections_blowholes || 0) + 
                           (shipment.rejections_handles || 0) + 
                           (shipment.rejections_other || 0);
      rejectedByOrderItem[shipment.order_item_id] = 
        (rejectedByOrderItem[shipment.order_item_id] || 0) + totalRejected;
    });
    
    // Calculate pending (ordered - shipped + rejected) per item
    // Rejected pieces need to be replaced, so they add to pending quantity
    const pending: Record<number, number> = {};
    allOrderItems.forEach(oi => {
      if (activeOrderIds.has(oi.order_id)) {
        const shipped = shippedByOrderItem[oi.id] || 0;
        const rejected = rejectedByOrderItem[oi.id] || 0;
        const pendingQty = oi.quantity - shipped + rejected;
        if (pendingQty > 0) {
          pending[oi.item_id] = (pending[oi.item_id] || 0) + pendingQty;
        }
      }
    });
    
    return pending;
  }

  async getOnHandStockByItemWithQuality(includeAcceptable: boolean): Promise<Record<number, number>> {
    // Calculate on-hand stock with quality filter
    const allBatches = await db.select().from(batches);
    
    const onHandStock: Record<number, number> = {};
    
    allBatches.forEach((batch) => {
      if (!batch.is_depleted && batch.quantity_remaining > 0) {
        // Include based on quality filter
        const shouldInclude = batch.quality_status === 'Good' || 
                             (includeAcceptable && batch.quality_status === 'Acceptable');
        
        if (shouldInclude) {
          onHandStock[batch.item_id] = (onHandStock[batch.item_id] || 0) + batch.quantity_remaining;
        }
      }
    });
    
    return onHandStock;
  }

  async getRejectedQuantitiesByItem(): Promise<Record<number, number>> {
    // Sum all rejected quantities per item from all batches
    const allBatches = await db.select().from(batches);
    
    const rejectedByItem: Record<number, number> = {};
    
    allBatches.forEach((batch) => {
      if (batch.quantity_rejected > 0) {
        rejectedByItem[batch.item_id] = (rejectedByItem[batch.item_id] || 0) + batch.quantity_rejected;
      }
    });
    
    return rejectedByItem;
  }
}

export const storage = new DbStorage();
