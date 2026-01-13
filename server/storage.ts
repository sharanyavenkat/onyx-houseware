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
  type Invoice,
  type InsertInvoice,
  type Accessory,
  type InsertAccessory,
  type Caster,
  type InsertCaster,
  users,
  items,
  customers,
  orders,
  orderItems,
  indents,
  shipments,
  batches,
  invoices,
  accessories,
  casters
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithRole(user: InsertUser, role: string): Promise<User>;
  updateUserRole(username: string, role: string): Promise<User | undefined>;

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
  updateOrderItem(id: number, updates: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  deleteOrder(id: number): Promise<void>;
  deleteOrderItems(orderId: number): Promise<void>;
  deleteOrderItem(id: number): Promise<void>;

  getIndentsByMonth(month: string): Promise<Indent[]>;
  upsertIndent(indent: InsertIndent): Promise<Indent>;
  deleteIndentsByItemId(itemId: number): Promise<void>;

  getShipmentsByOrderId(orderId: number): Promise<Shipment[]>;
  getShipmentsByOrderItemId(orderItemId: number): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<InsertShipment>): Promise<Shipment | undefined>;
  deleteShipment(id: number): Promise<void>;
  getNextShipmentNumber(): Promise<string>;
  assignShipmentsToInvoice(shipmentIds: number[], invoiceId: number | null): Promise<void>;

  getInvoicesByOrderId(orderId: number): Promise<Invoice[]>;
  getInvoiceById(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<void>;

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

  getAllAccessories(): Promise<Accessory[]>;
  getAccessoryById(id: number): Promise<Accessory | undefined>;
  createAccessory(accessory: InsertAccessory): Promise<Accessory>;
  updateAccessory(id: number, accessory: Partial<InsertAccessory>): Promise<Accessory | undefined>;
  deleteAccessory(id: number): Promise<void>;

  getAllCasters(): Promise<Caster[]>;
  getCasterById(id: number): Promise<Caster | undefined>;
  createCaster(caster: InsertCaster): Promise<Caster>;
  updateCaster(id: number, caster: Partial<InsertCaster>): Promise<Caster | undefined>;
  deleteCaster(id: number): Promise<void>;
  getCasterRejectionStats(casterId: number): Promise<{ totalReceived: number; totalRejected: number; rejectionRate: number; batchesWithRejections: Array<{ batchNumber: string; itemName: string; received: number; rejected: number; receivedDate: string }> }>;
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

  async createUserWithRole(insertUser: InsertUser, role: string): Promise<User> {
    const [user] = await db.insert(users).values({ ...insertUser, role }).returning();
    return user;
  }

  async updateUserRole(username: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ role }).where(eq(users.username, username)).returning();
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

  async updateOrderItem(id: number, updates: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const [updated] = await db.update(orderItems).set(updates).where(eq(orderItems.id, id)).returning();
    return updated;
  }

  async deleteOrderItem(id: number): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.id, id));
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
    // Auto-generate shipment number if not provided
    let shipmentData = { ...insertShipment };
    if (!shipmentData.shipment_number) {
      shipmentData.shipment_number = await this.getNextShipmentNumber();
    }
    const [shipment] = await db.insert(shipments).values(shipmentData).returning();
    
    // Update batch quantity_remaining (only if batch_number is provided)
    // Note: Rejections are now tracked at batch creation (from caster), not at shipment
    if (shipment.batch_number) {
      const allShipmentsForBatch = await db.select().from(shipments)
        .where(eq(shipments.batch_number, shipment.batch_number));
      
      const totalShipped = allShipmentsForBatch.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [batch] = await db.select().from(batches).where(eq(batches.batch_number, shipment.batch_number));
      if (batch) {
        // remaining = produced - shipped (rejections already subtracted from produced during QC)
        const newRemaining = batch.quantity_produced - totalShipped;
        await db.update(batches)
          .set({
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
      
      const oldTotalShipped = oldBatchShipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [oldBatch] = await db.select().from(batches).where(eq(batches.batch_number, oldBatchNumber));
      if (oldBatch) {
        // remaining = produced - shipped (rejections already subtracted from produced during QC)
        const oldNewRemaining = oldBatch.quantity_produced - oldTotalShipped;
        await db.update(batches)
          .set({
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
      
      const newTotalShipped = newBatchShipments.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [newBatch] = await db.select().from(batches).where(eq(batches.batch_number, newBatchNumber));
      if (newBatch) {
        // remaining = produced - shipped (rejections already subtracted from produced during QC)
        const newNewRemaining = newBatch.quantity_produced - newTotalShipped;
        await db.update(batches)
          .set({
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
    
    // Update batch quantity_remaining (only if batch_number exists)
    if (batchNumber) {
      const allShipmentsForBatch = await db.select().from(shipments)
        .where(eq(shipments.batch_number, batchNumber));
      
      const totalShipped = allShipmentsForBatch.reduce((sum, s) => sum + s.quantity_shipped, 0);
      
      const [batch] = await db.select().from(batches).where(eq(batches.batch_number, batchNumber));
      if (batch) {
        // remaining = produced - shipped (rejections already subtracted from produced during QC)
        const newRemaining = batch.quantity_produced - totalShipped;
        await db.update(batches)
          .set({
            quantity_remaining: Math.max(0, newRemaining),
            is_depleted: newRemaining <= 0
          })
          .where(eq(batches.batch_number, batchNumber));
      }
    }
  }

  async getNextShipmentNumber(): Promise<string> {
    // Get the highest shipment number to generate the next one
    const result = await db.select({ max_id: sql<number>`MAX(id)` }).from(shipments);
    const nextId = (result[0]?.max_id || 0) + 1;
    return `SHP-${String(nextId).padStart(3, '0')}`;
  }

  async assignShipmentsToInvoice(shipmentIds: number[], invoiceId: number | null): Promise<void> {
    for (const id of shipmentIds) {
      await db.update(shipments)
        .set({ invoice_id: invoiceId })
        .where(eq(shipments.id, id));
    }
  }

  async getInvoicesByOrderId(orderId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.order_id, orderId));
  }

  async getInvoiceById(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: number, updateData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
    return invoice;
  }

  async deleteInvoice(id: number): Promise<void> {
    // First unassign all shipments from this invoice
    await db.update(shipments)
      .set({ invoice_id: null })
      .where(eq(shipments.invoice_id, id));
    // Then delete the invoice
    await db.delete(invoices).where(eq(invoices.id, id));
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

  async updateBatch(id: number, updates: { batch_number?: string, received_date?: string, quantity_received?: number, quantity_produced?: number, quantity_rejected?: number, quality_status?: string, notes?: string, is_manual_quantity?: boolean }): Promise<Batch> {
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
    const newRejected = updates.quantity_rejected ?? currentBatch.quantity_rejected;
    
    // Get quantity_received - use provided value, stored value, or derive from current state
    const currentReceived = currentBatch.quantity_received || (currentBatch.quantity_produced + currentBatch.quantity_rejected);
    const newReceived = updates.quantity_received ?? currentReceived;
    
    // Validate rejected doesn't exceed received
    if (newRejected > newReceived) {
      const error: any = new Error(
        `Rejected quantity (${newRejected}) exceeds received quantity (${newReceived})`
      );
      error.code = 'INVALID_REJECTED_QUANTITY';
      throw error;
    }
    
    // Calculate new produced based on whether it's manually overridden
    // If is_manual_quantity flag is set, use provided quantity_produced
    // Otherwise, always derive from: produced = received - rejected
    const isManual = updates.is_manual_quantity ?? currentBatch.is_manual_quantity ?? false;
    let newProduced: number;
    
    if (updates.quantity_produced !== undefined) {
      // Caller explicitly provided produced value
      newProduced = updates.quantity_produced;
    } else if (isManual && currentBatch.is_manual_quantity) {
      // Keep existing manual value, but adjust if rejected changed
      // For manual batches, only recalculate if rejected increased beyond previous
      const rejectedDelta = newRejected - currentBatch.quantity_rejected;
      if (rejectedDelta > 0) {
        // Additional rejections reduce produced
        newProduced = Math.max(0, currentBatch.quantity_produced - rejectedDelta);
      } else {
        // Keep existing produced for manual batches
        newProduced = currentBatch.quantity_produced;
      }
    } else {
      // Auto-calculate: produced = received - rejected
      newProduced = Math.max(0, newReceived - newRejected);
    }
    
    // Calculate shipped from invariant: shipped = produced - remaining
    const currentShipped = currentBatch.quantity_produced - currentBatch.quantity_remaining;
    
    // Calculate new remaining: remaining = produced - shipped
    const newRemaining = newProduced - currentShipped;
    
    // Validate invariant: produced >= shipped (can't reduce produced below what's been shipped)
    if (newRemaining < 0) {
      const error: any = new Error(
        `Cannot update batch: new produced (${newProduced}) < shipped (${currentShipped}). ` +
        `Reduce rejections or update produced to at least ${currentShipped}.`
      );
      error.code = 'INVARIANT_VIOLATION';
      throw error;
    }
    
    // Calculate is_depleted flag
    const isDepleted = newRemaining === 0;

    // Update batch with all computed values
    const [updatedBatch] = await db.update(batches)
      .set({
        batch_number: newBatchNumber,
        received_date: newReceivedDate,
        quantity_received: newReceived,
        quantity_produced: newProduced,
        quantity_rejected: newRejected,
        quantity_remaining: newRemaining,
        quality_status: newQualityStatus,
        notes: newNotes,
        is_depleted: isDepleted,
        is_manual_quantity: updates.quantity_produced !== undefined ? (newProduced !== (newReceived - newRejected)) : (currentBatch.is_manual_quantity ?? false),
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
      // Calculate shipped from invariant: shipped = produced - remaining
      // (rejections are already subtracted from produced during QC)
      const currentShipped = batch.quantity_produced - batch.quantity_remaining;
      const newRemaining = newProduced - currentShipped;
      
      // Validate that new remaining is non-negative
      if (newRemaining < 0) {
        const error: any = new Error(
          `Cannot update batch: new produced quantity (${newProduced}) is less than shipped (${currentShipped})`
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

    // Calculate current shipped quantity: shipped = produced - remaining
    // (rejections are already subtracted from produced during QC)
    const currentShipped = batch.quantity_produced - batch.quantity_remaining;

    // Validate that existing data doesn't violate invariants
    if (currentShipped < 0) {
      const error: any = new Error(
        `Batch ${batch.batch_number} has invalid historical data (shipped cannot be negative). ` +
        `Produced: ${batch.quantity_produced}, ` +
        `Remaining: ${batch.quantity_remaining}, ` +
        `Derived shipped: ${currentShipped}`
      );
      error.code = 'INVARIANT_VIOLATION';
      throw error;
    }

    // Calculate received quantity from batch data
    const received = batch.quantity_received || (batch.quantity_produced + batch.quantity_rejected);
    
    // Validate that new rejected quantity doesn't exceed received quantity
    if (newRejected > received) {
      const error: any = new Error(
        `Rejected quantity (${newRejected}) exceeds received quantity (${received}) in batch ${batch.batch_number}`
      );
      error.code = 'INSUFFICIENT_QUANTITY';
      throw error;
    }

    // Calculate new produced: produced = received - rejected
    const newProduced = received - newRejected;
    
    // Validate that we still have enough produced for what's already shipped
    if (newProduced < currentShipped) {
      const error: any = new Error(
        `Cannot increase rejection: would result in produced (${newProduced}) < shipped (${currentShipped}) in batch ${batch.batch_number}`
      );
      error.code = 'INSUFFICIENT_QUANTITY';
      throw error;
    }

    // Recompute remaining: remaining = produced - shipped
    const newRemaining = newProduced - currentShipped;

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

    // Update batch with new rejected quantity, recalculated produced and remaining
    const updates: any = {
      quantity_rejected: newRejected,
      quantity_produced: newProduced,
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

      // Calculate current shipped: shipped = produced - remaining
      // (rejections are already subtracted from produced during QC)
      const currentShipped = batch.quantity_produced - batch.quantity_remaining;
      
      // Validate that existing data doesn't violate invariants (catches bad historical data)
      if (currentShipped < 0) {
        const error: any = new Error(
          `Batch ${batchNumber} has invalid historical data (shipped cannot be negative). ` +
          `Produced: ${batch.quantity_produced}, ` +
          `Remaining: ${batch.quantity_remaining}, ` +
          `Derived shipped: ${currentShipped}`
        );
        error.code = 'INVARIANT_VIOLATION';
        throw error;
      }

      // Get received quantity from batch data
      const received = batch.quantity_received || (batch.quantity_produced + batch.quantity_rejected);
      
      // Apply rejection adjustment first (affects produced)
      const newRejected = batch.quantity_rejected + rejectedDelta;
      const newProduced = received - newRejected;
      
      // Validate rejection doesn't exceed received
      if (newRejected > received) {
        const error: any = new Error(
          `Rejection adjustment would exceed received quantity in batch ${batchNumber}. ` +
          `Received: ${received}, New rejected: ${newRejected}`
        );
        error.code = 'INSUFFICIENT_QUANTITY';
        throw error;
      }

      // Apply shipped adjustment
      const newShipped = currentShipped + shippedDelta;
      
      // Calculate new remaining: remaining = produced - shipped
      const newRemaining = newProduced - newShipped;

      // Validate sufficient quantity for this adjustment
      if (newRemaining < 0) {
        const error: any = new Error(
          `Insufficient quantity in batch ${batchNumber}. ` +
          `New produced: ${newProduced}, New shipped: ${newShipped}, ` +
          `Would result in remaining: ${newRemaining}`
        );
        error.code = 'INSUFFICIENT_QUANTITY';
        throw error;
      }

      // Update batch with new calculated values and auto-compute depleted flag
      const [updated] = await tx.update(batches)
        .set({
          quantity_produced: newProduced,
          quantity_rejected: newRejected,
          quantity_remaining: newRemaining,
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
    
    // Calculate shipped quantities per order item
    // Note: Rejections are now tracked at batch level (caster receipt), not shipment level
    // Customer rejections don't trigger replacements - orders are considered complete
    const shippedByOrderItem: Record<number, number> = {};
    allShipments.forEach(shipment => {
      shippedByOrderItem[shipment.order_item_id] = 
        (shippedByOrderItem[shipment.order_item_id] || 0) + shipment.quantity_shipped;
    });
    
    // Calculate pending (ordered - shipped) per item
    const pending: Record<number, number> = {};
    allOrderItems.forEach(oi => {
      if (activeOrderIds.has(oi.order_id)) {
        const shipped = shippedByOrderItem[oi.id] || 0;
        const pendingQty = oi.quantity - shipped;
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

  async getAllAccessories(): Promise<Accessory[]> {
    return await db.select().from(accessories);
  }

  async getAccessoryById(id: number): Promise<Accessory | undefined> {
    const [accessory] = await db.select().from(accessories).where(eq(accessories.id, id));
    return accessory;
  }

  async createAccessory(insertAccessory: InsertAccessory): Promise<Accessory> {
    const [accessory] = await db.insert(accessories).values(insertAccessory).returning();
    return accessory;
  }

  async updateAccessory(id: number, updates: Partial<InsertAccessory>): Promise<Accessory | undefined> {
    const [accessory] = await db.update(accessories).set(updates).where(eq(accessories.id, id)).returning();
    return accessory;
  }

  async deleteAccessory(id: number): Promise<void> {
    await db.delete(accessories).where(eq(accessories.id, id));
  }

  async getAllCasters(): Promise<Caster[]> {
    return await db.select().from(casters);
  }

  async getCasterById(id: number): Promise<Caster | undefined> {
    const [caster] = await db.select().from(casters).where(eq(casters.id, id));
    return caster;
  }

  async createCaster(insertCaster: InsertCaster): Promise<Caster> {
    const [caster] = await db.insert(casters).values(insertCaster).returning();
    return caster;
  }

  async updateCaster(id: number, updates: Partial<InsertCaster>): Promise<Caster | undefined> {
    const [caster] = await db.update(casters).set(updates).where(eq(casters.id, id)).returning();
    return caster;
  }

  async deleteCaster(id: number): Promise<void> {
    await db.delete(casters).where(eq(casters.id, id));
  }

  async getCasterRejectionStats(casterId: number): Promise<{ 
    totalReceived: number; 
    totalRejected: number; 
    rejectionRate: number; 
    batchesWithRejections: Array<{ batchNumber: string; itemName: string; received: number; rejected: number; receivedDate: string }> 
  }> {
    // Get all batches for this caster
    const casterBatches = await db.select().from(batches).where(eq(batches.caster_id, casterId));
    
    // Get all items for names
    const allItems = await db.select().from(items);
    const itemMap = new Map(allItems.map(i => [i.id, i.name]));
    
    let totalReceived = 0;
    let totalRejected = 0;
    const batchesWithRejections: Array<{ batchNumber: string; itemName: string; received: number; rejected: number; receivedDate: string }> = [];
    
    casterBatches.forEach(batch => {
      totalReceived += batch.quantity_received || 0;
      totalRejected += batch.quantity_rejected || 0;
      
      // Only include batches that have rejections
      if (batch.quantity_rejected > 0) {
        batchesWithRejections.push({
          batchNumber: batch.batch_number,
          itemName: itemMap.get(batch.item_id) || 'Unknown',
          received: batch.quantity_received || 0,
          rejected: batch.quantity_rejected,
          receivedDate: batch.received_date
        });
      }
    });
    
    // Sort by received_date descending
    batchesWithRejections.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
    
    const rejectionRate = totalReceived > 0 ? (totalRejected / totalReceived) * 100 : 0;
    
    return {
      totalReceived,
      totalRejected,
      rejectionRate,
      batchesWithRejections
    };
  }
}

export const storage = new DbStorage();
