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
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type IngotDispatch,
  type InsertIngotDispatch,
  type SkuWastageOverride,
  type InsertSkuWastageOverride,
  type Die,
  type InsertDie,
  type Rework,
  type InsertRework,
  type VendorMetalStatement,
  type InsertVendorMetalStatement,
  type BomComponent,
  type OrderAccessoryItem,
  type InsertOrderAccessoryItem,
  type OrderAccessoryShipment,
  type InsertOrderAccessoryShipment,
  type Projection,
  type InsertProjection,
  type CoatingConversion,
  type InsertCoatingConversion,
  type CoatingConversionAllocation,
  type InsertBomComponent,
  type AppSetting,
  type KitShipmentAllocation,
  type InsertKitShipmentAllocation,
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
  casters,
  purchaseOrders,
  purchaseOrderItems,
  ingotDispatches,
  skuWastageOverrides,
  dies,
  reworks,
  vendorMetalStatements,
  bomComponents,
  orderAccessoryItems,
  orderAccessoryShipments,
  projections,
  coatingConversions,
  coatingConversionAllocations,
  appSettings,
  kitShipmentAllocations,
  SETTINGS_KEYS,
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
  getShipmentById(id: number): Promise<Shipment | undefined>;
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
  // Sum of (quantity_ordered - quantity_received) across open (non-completed,
  // non-cancelled) purchase orders, grouped by item — used as the default
  // "expected receipts" in Indent instead of manual entry.
  getOpenPurchaseOrderQtyByItem(): Promise<Record<number, number>>;
  // For the dashboard "Vendors Requiring Attention" card: flags casters with
  // a high rejection rate this month, or a metal balance closing_balance_kg
  // that's grown beyond a threshold (metal outstanding without castings back).
  getVendorAttentionSummary(): Promise<Array<{
    casterId: number;
    casterName: string;
    rejectionRatePct: number | null;
    metalBalanceKg: number | null;
    flagReason: string;
  }>>;
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

  getAllPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrdersByCasterId(casterId: number): Promise<PurchaseOrder[]>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: number, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: number): Promise<void>;
  getPurchaseOrderItemsByPOId(purchaseOrderId: number): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: number, updates: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: number): Promise<void>;
  deletePurchaseOrderItemsByPOId(purchaseOrderId: number): Promise<void>;
  recalculatePurchaseOrderReceived(purchaseOrderId: number): Promise<void>;
  checkAndAutoCompletePurchaseOrder(purchaseOrderId: number): Promise<void>;

  getAllIngotDispatches(): Promise<IngotDispatch[]>;
  getIngotDispatchById(id: number): Promise<IngotDispatch | undefined>;
  getIngotDispatchesByCasterId(casterId: number): Promise<IngotDispatch[]>;
  createIngotDispatch(dispatch: InsertIngotDispatch): Promise<IngotDispatch>;
  updateIngotDispatch(id: number, dispatch: Partial<InsertIngotDispatch>): Promise<IngotDispatch | undefined>;
  deleteIngotDispatch(id: number): Promise<void>;

  // Wastage: resolves the effective wastage % for a caster+item+material_type,
  // checking sku_wastage_overrides first (exact material_type, then null=both),
  // then the caster's own default, then the company-wide fallback (6% ingot / 8% scrap).
  resolveWastagePct(casterId: number, itemId: number, materialType: "ingot" | "scrap"): Promise<number>;
  resolveBlendedWastagePct(casterId: number, itemId: number, ingotKgSent: number, scrapKgSent: number): Promise<number>;

  getAllSettings(): Promise<AppSetting[]>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<AppSetting>;
  getAllSkuWastageOverrides(): Promise<SkuWastageOverride[]>;
  createSkuWastageOverride(o: InsertSkuWastageOverride): Promise<SkuWastageOverride>;
  updateSkuWastageOverride(id: number, o: Partial<InsertSkuWastageOverride>): Promise<SkuWastageOverride | undefined>;
  deleteSkuWastageOverride(id: number): Promise<void>;

  getIngotReconciliationByCaster(casterId: number): Promise<{
    totalIngotKgSent: number;
    totalScrapKgSent: number;
    totalMetalKgSent: number;
    totalFinishedWeightKgReceived: number;
    expectedMetalConsumedKg: number | null;
    varianceKg: number | null;
    variancePercent: number | null;
    actualPieceCount: number;
    itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
    rework: {
      totalReworkKgSent: number;
      piecesSent: number;
      piecesReplaced: number;
      piecesPending: number;
    };
  }>;

  getAllDies(): Promise<Die[]>;
  getDieById(id: number): Promise<Die | undefined>;
  getDiesByCasterId(casterId: number): Promise<Die[]>;
  createDie(die: InsertDie): Promise<Die>;
  updateDie(id: number, die: Partial<InsertDie>): Promise<Die | undefined>;
  deleteDie(id: number): Promise<void>;

  getAllReworks(): Promise<Rework[]>;
  getReworkById(id: number): Promise<Rework | undefined>;
  getReworksByCasterId(casterId: number): Promise<Rework[]>;
  createRework(rework: InsertRework): Promise<Rework>;
  updateRework(id: number, rework: Partial<InsertRework>): Promise<Rework | undefined>;
  deleteRework(id: number): Promise<void>;

  getAllVendorMetalStatements(): Promise<VendorMetalStatement[]>;
  getVendorMetalStatementsByCasterId(casterId: number): Promise<VendorMetalStatement[]>;
  createVendorMetalStatement(s: InsertVendorMetalStatement): Promise<VendorMetalStatement>;
  updateVendorMetalStatement(id: number, s: Partial<InsertVendorMetalStatement>): Promise<VendorMetalStatement | undefined>;
  deleteVendorMetalStatement(id: number): Promise<void>;
  // Computes Onyx's side of the statement for a caster as of the end of periodMonth
  // ('YYYY-MM'): cumulative dispatched-to-date, wastage-adjusted expected consumption,
  // actual finished weight received-to-date, and the resulting running balance.
  calculateMetalStatementForPeriod(casterId: number, periodMonth: string): Promise<{
    openingBalanceKg: number;
    dispatchedKg: number;
    expectedMetalConsumedKg: number;
    actualFinishedWeightKg: number;
    closingBalanceKg: number;
    itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
  }>;

  getAllBomComponents(): Promise<BomComponent[]>;
  getBomComponentsByParentId(parentItemId: number): Promise<BomComponent[]>;
  createBomComponent(c: InsertBomComponent): Promise<BomComponent>;
  updateBomComponent(id: number, c: Partial<InsertBomComponent>): Promise<BomComponent | undefined>;
  deleteBomComponent(id: number): Promise<void>;
  deleteBomComponentsByParentId(parentItemId: number): Promise<void>;
  // For a kit item, ships qty kits' worth of components: FIFO-deducts from each
  // component item's batches, decrements accessory stock for accessory components.
  shipKitComponents(parentItemId: number, quantityKits: number, shipmentDate: string): Promise<{
    itemDeductions: Array<{ itemId: number; itemName: string; quantityDeducted: number }>;
    accessoryDeductions: Array<{ accessoryId: number; accessoryName: string; quantityDeducted: number }>;
    allocations: Array<{
      component_type: "item" | "accessory";
      component_item_id?: number;
      component_accessory_id?: number;
      batch_id?: number;
      quantity: number;
    }>;
  }>;
  // Restores stock exactly per a shipment's recorded allocations (undoing
  // shipKitComponents), then deletes those allocation records.
  reverseKitShipmentAllocations(shipmentId: number): Promise<void>;

  getOrderAccessoryItemsByOrderId(orderId: number): Promise<OrderAccessoryItem[]>;
  createOrderAccessoryItem(item: InsertOrderAccessoryItem): Promise<OrderAccessoryItem>;
  updateOrderAccessoryItem(id: number, item: Partial<InsertOrderAccessoryItem>): Promise<OrderAccessoryItem | undefined>;
  deleteOrderAccessoryItem(id: number): Promise<void>;

  getOrderAccessoryShipmentsByOrderId(orderId: number): Promise<OrderAccessoryShipment[]>;
  createOrderAccessoryShipment(shipment: InsertOrderAccessoryShipment): Promise<OrderAccessoryShipment>;
  deleteOrderAccessoryShipment(id: number): Promise<void>;

  // Order component summary: decomposes every line on an order (kits via
  // BOM, direct items, accessory lines) into a flat rollup of "this order
  // actually represents X of item A, Y of item B, Z of accessory C" —
  // closes the gap between "100 CS10 kits" and "100 tawas, 100 kadais...".
  getOrderComponentSummary(orderId: number): Promise<{
    items: Array<{ itemId: number; itemName: string; quantity: number }>;
    accessories: Array<{ accessoryId: number; accessoryName: string; quantity: number }>;
  }>;

  getProjectionsByMonth(month: string): Promise<Projection[]>;
  upsertProjection(itemId: number, month: string, quantity: number, notes?: string | null): Promise<Projection>;

  getAllCoatingConversions(): Promise<CoatingConversion[]>;
  getCoatingConversionById(id: number): Promise<CoatingConversion | undefined>;
  createCoatingConversion(data: InsertCoatingConversion): Promise<CoatingConversion>;
  receiveCoatingConversion(id: number, data: { quantity_received: number; quantity_rejected: number; received_date: string; color?: string | null }): Promise<CoatingConversion>;
  deleteCoatingConversion(id: number): Promise<void>;
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
    // Deleting the order via DB cascade alone would silently wipe its
    // shipments (and kit_shipment_allocations) WITHOUT reversing their stock
    // effect — the batch/accessory deductions would be permanently orphaned,
    // since the shipment record that explains them is gone. Route through
    // deleteShipment() for each one first, since that already has the
    // correct reversal logic for both normal batches and kit allocations.
    const orderShipments = await db.select().from(shipments).where(eq(shipments.order_id, id));
    for (const s of orderShipments) {
      await this.deleteShipment(s.id);
    }
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

  async getShipmentById(id: number): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
    return shipment;
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

    // If no batch_number was given, this might be a kit order line — kits
    // have no batch of their own, they're shipped by decomposing the BOM.
    // Resolve this BEFORE inserting the shipment row, so a stock shortfall
    // (thrown by shipKitComponents) doesn't leave an orphan shipment record.
    let kitItemId: number | null = null;
    if (!shipmentData.batch_number) {
      const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, shipmentData.order_item_id));
      if (orderItem) {
        const [item] = await db.select().from(items).where(eq(items.id, orderItem.item_id));
        if (item?.is_kit) {
          kitItemId = item.id;
        }
      }
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
    } else if (kitItemId !== null) {
      try {
        const { allocations } = await this.shipKitComponents(kitItemId, shipment.quantity_shipped, shipment.shipment_date);
        if (allocations.length > 0) {
          await db.insert(kitShipmentAllocations).values(
            allocations.map(a => ({ ...a, shipment_id: shipment.id }))
          );
        }
      } catch (err) {
        // Roll back the shipment record — it doesn't correspond to a real
        // stock movement if the components couldn't actually be deducted.
        await db.delete(shipments).where(eq(shipments.id, shipment.id));
        throw err;
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
    
    // Kit shipment (no batch_number on either side) — since a kit draws from
    // multiple batches via FIFO, we don't compute a delta; we reverse the old
    // allocations fully and reapply at the new quantity/date, which stays
    // correct even if stock has moved since the original shipment.
    if (!oldBatchNumber && !newBatchNumber) {
      const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, shipment.order_item_id));
      if (orderItem) {
        const [item] = await db.select().from(items).where(eq(items.id, orderItem.item_id));
        if (item?.is_kit) {
          await this.reverseKitShipmentAllocations(id);
          try {
            const { allocations } = await this.shipKitComponents(item.id, shipment.quantity_shipped, shipment.shipment_date);
            if (allocations.length > 0) {
              await db.insert(kitShipmentAllocations).values(
                allocations.map(a => ({ ...a, shipment_id: shipment.id }))
              );
            }
          } catch (err) {
            // Couldn't reapply at the new quantity — restore at the ORIGINAL
            // quantity so stock isn't left in limbo, then surface the error.
            const { allocations: restoreAllocations } = await this.shipKitComponents(
              item.id, oldShipment.quantity_shipped, oldShipment.shipment_date
            );
            if (restoreAllocations.length > 0) {
              await db.insert(kitShipmentAllocations).values(
                restoreAllocations.map(a => ({ ...a, shipment_id: shipment.id }))
              );
            }
            await db.update(shipments)
              .set({ quantity_shipped: oldShipment.quantity_shipped, shipment_date: oldShipment.shipment_date })
              .where(eq(shipments.id, id));
            throw err;
          }
        }
      }
    }
    
    return shipment;
  }

  async deleteShipment(id: number): Promise<void> {
    // Get shipment before deleting to know which batch to update
    const [shipmentToDelete] = await db.select().from(shipments).where(eq(shipments.id, id));
    if (!shipmentToDelete) return;
    
    const batchNumber = shipmentToDelete.batch_number;

    // If this was a kit shipment (no batch_number), restore its allocations
    // BEFORE deleting — the allocations cascade-delete with the shipment row,
    // so this has to happen first or there'd be nothing left to reverse.
    if (!batchNumber) {
      await this.reverseKitShipmentAllocations(id);
    }
    
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
      .orderBy(batches.received_date);  // Order by oldest first (ascending) for FIFO
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const [batch] = await db.insert(batches).values(insertBatch).returning();
    return batch;
  }

  async updateBatch(id: number, updates: { batch_number?: string, caster_id?: number | null, received_date?: string, quantity_received?: number, quantity_produced?: number, quantity_rejected?: number, quality_status?: string, notes?: string, is_manual_quantity?: boolean }): Promise<Batch> {
    // Get current batch
    const [currentBatch] = await db.select().from(batches).where(eq(batches.id, id));
    
    if (!currentBatch) {
      const error: any = new Error(`Batch with id ${id} not found`);
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }

    // Build merged batch state with updates applied
    const newBatchNumber = updates.batch_number ?? currentBatch.batch_number;
    const newCasterId = updates.caster_id !== undefined ? updates.caster_id : currentBatch.caster_id;
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
        caster_id: newCasterId,
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

    return db.transaction((tx) => {
      // Lock the row and get current state using transaction handle
      // NOTE: this callback must stay synchronous (no async/await) — better-sqlite3
      // transactions execute as a single synchronous unit and throw
      // "Transaction function cannot return a promise" if the callback is async.
      const batch = tx.select().from(batches)
        .where(eq(batches.batch_number, batchNumber)).get();

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
      const updated = tx.update(batches)
        .set({
          quantity_produced: newProduced,
          quantity_rejected: newRejected,
          quantity_remaining: newRemaining,
          is_depleted: newRemaining === 0
        })
        .where(eq(batches.batch_number, batchNumber))
        .returning()
        .get();

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

    const allItems = await db.select().from(items);
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    
    // Calculate shipped quantities per order item
    // Note: Rejections are now tracked at batch level (caster receipt), not shipment level
    // Customer rejections don't trigger replacements - orders are considered complete
    const shippedByOrderItem: Record<number, number> = {};
    allShipments.forEach(shipment => {
      shippedByOrderItem[shipment.order_item_id] = 
        (shippedByOrderItem[shipment.order_item_id] || 0) + shipment.quantity_shipped;
    });
    
    // Calculate pending (ordered - shipped) per item. A kit line's pending
    // quantity gets decomposed through its BOM into real component demand —
    // e.g. 63 pending CSTONE CS10 becomes 63 pending Tawa (plus every other
    // component) — since that's what Indent actually needs to plan against.
    // Without this, kit-derived demand is invisible here even though it's
    // already correctly shown on the order's own "What This Order Actually
    // Represents" summary.
    const pending: Record<number, number> = {};
    for (const oi of allOrderItems) {
      if (!activeOrderIds.has(oi.order_id)) continue;
      const shipped = shippedByOrderItem[oi.id] || 0;
      const pendingQty = oi.quantity - shipped;
      if (pendingQty <= 0) continue;

      const item = itemMap.get(oi.item_id);
      if (item?.is_kit) {
        const components = await this.getBomComponentsByParentId(item.id);
        for (const c of components) {
          if (c.component_type === 'item' && c.component_item_id) {
            const qty = c.qty_per_kit * pendingQty;
            pending[c.component_item_id] = (pending[c.component_item_id] || 0) + qty;
          }
        }
      } else {
        pending[oi.item_id] = (pending[oi.item_id] || 0) + pendingQty;
      }
    }
    
    return pending;
  }

  async getOpenPurchaseOrderQtyByItem(): Promise<Record<number, number>> {
    const openPOs = await db.select().from(purchaseOrders).where(
      sql`${purchaseOrders.status} NOT IN ('completed', 'cancelled')`
    );
    const openPOIds = new Set(openPOs.map(po => po.id));
    if (openPOIds.size === 0) return {};

    const allPOItems = await db.select().from(purchaseOrderItems);
    const result: Record<number, number> = {};
    for (const poi of allPOItems) {
      if (!openPOIds.has(poi.purchase_order_id)) continue;
      const outstanding = poi.quantity_ordered - poi.quantity_received;
      if (outstanding > 0) {
        result[poi.item_id] = (result[poi.item_id] || 0) + outstanding;
      }
    }
    return result;
  }

  /**
   * Flags a caster when either: (a) their overall rejection rate across all
   * batches is 10%+ (worth a conversation), or (b) their running metal
   * balance (from getIngotReconciliationByCaster) shows a positive variance
   * beyond a small tolerance — i.e. more metal sent than wastage-adjusted
   * consumption accounts for, meaning castings are overdue.
   */
  async getVendorAttentionSummary(): Promise<Array<{
    casterId: number;
    casterName: string;
    rejectionRatePct: number | null;
    metalBalanceKg: number | null;
    flagReason: string;
  }>> {
    const allCasters = await this.getAllCasters();
    const flagged: Array<{
      casterId: number;
      casterName: string;
      rejectionRatePct: number | null;
      metalBalanceKg: number | null;
      flagReason: string;
    }> = [];

    for (const caster of allCasters) {
      const reasons: string[] = [];
      let rejectionRatePct: number | null = null;
      let metalBalanceKg: number | null = null;

      const casterBatches = await db.select().from(batches).where(eq(batches.caster_id, caster.id));
      if (casterBatches.length > 0) {
        const totalReceived = casterBatches.reduce((sum, b) => sum + b.quantity_received, 0);
        const totalRejected = casterBatches.reduce((sum, b) => sum + b.quantity_rejected, 0);
        if (totalReceived > 0) {
          rejectionRatePct = (totalRejected / totalReceived) * 100;
          if (rejectionRatePct >= 10) {
            reasons.push(`${rejectionRatePct.toFixed(1)}% rejection rate`);
          }
        }
      }

      const dispatches = await this.getIngotDispatchesByCasterId(caster.id);
      if (dispatches.some(d => d.material_type !== 'rework')) {
        const recon = await this.getIngotReconciliationByCaster(caster.id);
        if (recon.varianceKg !== null) {
          metalBalanceKg = recon.varianceKg;
          // Flag when the caster is holding more than ~50kg (or 5% of metal
          // sent, whichever is larger) beyond what their production accounts for
          const tolerance = Math.max(50, recon.totalMetalKgSent * 0.05);
          if (recon.varianceKg > tolerance) {
            reasons.push(`${recon.varianceKg.toFixed(0)}kg metal balance outstanding`);
          }
        }
      }

      if (reasons.length > 0) {
        flagged.push({
          casterId: caster.id,
          casterName: caster.name,
          rejectionRatePct,
          metalBalanceKg,
          flagReason: reasons.join('; '),
        });
      }
    }

    return flagged.sort((a, b) => (b.metalBalanceKg ?? 0) - (a.metalBalanceKg ?? 0));
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
  async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.order_date));
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined> {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return po;
  }

  async getPurchaseOrdersByCasterId(casterId: number): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.caster_id, casterId))
      .orderBy(desc(purchaseOrders.order_date));
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [created] = await db.insert(purchaseOrders).values(po).returning();
    return created;
  }

  async updatePurchaseOrder(id: number, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updated] = await db.update(purchaseOrders).set(po).where(eq(purchaseOrders.id, id)).returning();
    return updated;
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  async getPurchaseOrderItemsByPOId(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchase_order_id, purchaseOrderId));
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [created] = await db.insert(purchaseOrderItems).values(item).returning();
    return created;
  }

  async updatePurchaseOrderItem(id: number, updates: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const [updated] = await db.update(purchaseOrderItems).set(updates).where(eq(purchaseOrderItems.id, id)).returning();
    return updated;
  }

  async deletePurchaseOrderItem(id: number): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
  }

  async deletePurchaseOrderItemsByPOId(purchaseOrderId: number): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchase_order_id, purchaseOrderId));
  }

  async recalculatePurchaseOrderReceived(purchaseOrderId: number): Promise<void> {
    const poItems = await this.getPurchaseOrderItemsByPOId(purchaseOrderId);
    const linkedBatches = await db.select().from(batches)
      .where(eq(batches.purchase_order_id, purchaseOrderId));

    for (const poItem of poItems) {
      const received = linkedBatches
        .filter(b => b.item_id === poItem.item_id)
        .reduce((sum, b) => sum + b.quantity_received, 0);
      await db.update(purchaseOrderItems)
        .set({ quantity_received: received })
        .where(eq(purchaseOrderItems.id, poItem.id));
    }
  }

  async checkAndAutoCompletePurchaseOrder(purchaseOrderId: number): Promise<void> {
    const poItems = await this.getPurchaseOrderItemsByPOId(purchaseOrderId);
    if (poItems.length === 0) return;

    const allReceived = poItems.every(item => item.quantity_received >= item.quantity_ordered);
    const po = await this.getPurchaseOrderById(purchaseOrderId);
    if (!po) return;

    if (allReceived && po.status === 'confirmed') {
      await db.update(purchaseOrders)
        .set({ status: 'completed' })
        .where(eq(purchaseOrders.id, purchaseOrderId));
    } else if (!allReceived && po.status === 'completed') {
      await db.update(purchaseOrders)
        .set({ status: 'confirmed' })
        .where(eq(purchaseOrders.id, purchaseOrderId));
    }
  }

  async getAllIngotDispatches(): Promise<IngotDispatch[]> {
    return await db.select().from(ingotDispatches).orderBy(desc(ingotDispatches.dispatch_date));
  }

  async getIngotDispatchById(id: number): Promise<IngotDispatch | undefined> {
    const [dispatch] = await db.select().from(ingotDispatches).where(eq(ingotDispatches.id, id));
    return dispatch;
  }

  async getIngotDispatchesByCasterId(casterId: number): Promise<IngotDispatch[]> {
    return await db.select().from(ingotDispatches)
      .where(eq(ingotDispatches.caster_id, casterId))
      .orderBy(desc(ingotDispatches.dispatch_date));
  }

  async createIngotDispatch(dispatch: InsertIngotDispatch): Promise<IngotDispatch> {
    const [created] = await db.insert(ingotDispatches).values(dispatch).returning();
    return created;
  }

  async updateIngotDispatch(id: number, dispatch: Partial<InsertIngotDispatch>): Promise<IngotDispatch | undefined> {
    const [updated] = await db.update(ingotDispatches).set(dispatch).where(eq(ingotDispatches.id, id)).returning();
    return updated;
  }

  async deleteIngotDispatch(id: number): Promise<void> {
    await db.delete(ingotDispatches).where(eq(ingotDispatches.id, id));
  }

  /**
   * Resolves effective wastage % for a caster+item+material_type:
   * 1. SKU override for this exact material_type
   * 2. SKU override with material_type = null (applies to both)
   * 3. Caster's own default for this material_type
   * 4. Company-wide fallback: 6% ingot, 8% scrap
   */
  async resolveWastagePct(casterId: number, itemId: number, materialType: "ingot" | "scrap"): Promise<number> {
    const overrides = await db.select().from(skuWastageOverrides)
      .where(and(eq(skuWastageOverrides.caster_id, casterId), eq(skuWastageOverrides.item_id, itemId)));

    const exact = overrides.find(o => o.material_type === materialType);
    if (exact) return exact.wastage_pct;

    const both = overrides.find(o => o.material_type === null);
    if (both) return both.wastage_pct;

    const [caster] = await db.select().from(casters).where(eq(casters.id, casterId));
    if (caster) {
      const vendorDefault = materialType === "ingot" ? caster.default_wastage_ingot_pct : caster.default_wastage_scrap_pct;
      if (vendorDefault !== null && vendorDefault !== undefined) return vendorDefault;
    }

    const settingKey = materialType === "ingot" ? SETTINGS_KEYS.DEFAULT_WASTAGE_INGOT_PCT : SETTINGS_KEYS.DEFAULT_WASTAGE_SCRAP_PCT;
    const companyDefault = await this.getSetting(settingKey);
    if (companyDefault !== undefined) {
      const parsed = parseFloat(companyDefault);
      if (!isNaN(parsed)) return parsed;
    }

    // Last-resort fallback if settings somehow aren't seeded yet
    return materialType === "ingot" ? 6 : 8;
  }

  async getAllSettings(): Promise<AppSetting[]> {
    return await db.select().from(appSettings);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<AppSetting> {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (existing.length > 0) {
      const [updated] = await db.update(appSettings)
        .set({ value, updated_at: new Date().toISOString() })
        .where(eq(appSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(appSettings)
      .values({ key, value, updated_at: new Date().toISOString() })
      .returning();
    return created;
  }

  /**
   * Blends the ingot and scrap wastage rates for a caster+item, weighted by
   * the actual proportion of ingot vs. scrap kg sent (since casters melt both
   * together, not separately, so a batch's expected consumption should
   * reflect the real metal mix, not always assume pure ingot). Falls back to
   * the pure ingot rate if nothing's been dispatched yet (ratio undefined).
   */
  async resolveBlendedWastagePct(casterId: number, itemId: number, ingotKgSent: number, scrapKgSent: number): Promise<number> {
    const totalKg = ingotKgSent + scrapKgSent;
    if (totalKg <= 0) {
      return this.resolveWastagePct(casterId, itemId, "ingot");
    }
    const [ingotWastage, scrapWastage] = await Promise.all([
      this.resolveWastagePct(casterId, itemId, "ingot"),
      this.resolveWastagePct(casterId, itemId, "scrap"),
    ]);
    const ingotRatio = ingotKgSent / totalKg;
    const scrapRatio = scrapKgSent / totalKg;
    return ingotRatio * ingotWastage + scrapRatio * scrapWastage;
  }

  async getAllSkuWastageOverrides(): Promise<SkuWastageOverride[]> {
    return await db.select().from(skuWastageOverrides);
  }

  async createSkuWastageOverride(o: InsertSkuWastageOverride): Promise<SkuWastageOverride> {
    const [created] = await db.insert(skuWastageOverrides).values(o).returning();
    return created;
  }

  async updateSkuWastageOverride(id: number, o: Partial<InsertSkuWastageOverride>): Promise<SkuWastageOverride | undefined> {
    const [updated] = await db.update(skuWastageOverrides).set(o).where(eq(skuWastageOverrides.id, id)).returning();
    return updated;
  }

  async deleteSkuWastageOverride(id: number): Promise<void> {
    await db.delete(skuWastageOverrides).where(eq(skuWastageOverrides.id, id));
  }

  /**
   * Compares metal dispatched to a caster against the wastage-adjusted metal
   * that SHOULD have been consumed to produce what was actually received —
   * i.e. for each batch, (pieces x SKU weight) / (1 - resolved wastage %),
   * summed and compared to total ingot+scrap sent. This uses each SKU's own
   * exact weight (no blended averaging across different SKUs) and each
   * caster+SKU's own resolved wastage rate.
   *
   * Rework replacement batches are excluded — they're free 1:1 swaps that
   * don't draw on the dispatched metal balance — and reported separately.
   * Wastage rate used per batch is the resolved "ingot" rate, since caster
   * dispatches aren't split by material type per batch (documented assumption).
   */
  async getIngotReconciliationByCaster(casterId: number): Promise<{
    totalIngotKgSent: number;
    totalScrapKgSent: number;
    totalMetalKgSent: number;
    totalFinishedWeightKgReceived: number;
    expectedMetalConsumedKg: number | null;
    varianceKg: number | null;
    variancePercent: number | null;
    actualPieceCount: number;
    itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
    rework: {
      totalReworkKgSent: number;
      piecesSent: number;
      piecesReplaced: number;
      piecesPending: number;
    };
  }> {
    const dispatches = await this.getIngotDispatchesByCasterId(casterId);
    const totalIngotKgSent = dispatches
      .filter(d => d.material_type === 'ingot')
      .reduce((sum, d) => sum + d.quantity_kg, 0);
    const totalScrapKgSent = dispatches
      .filter(d => d.material_type === 'scrap')
      .reduce((sum, d) => sum + d.quantity_kg, 0);
    const totalMetalKgSent = totalIngotKgSent + totalScrapKgSent;

    const casterReworks = await this.getReworksByCasterId(casterId);
    const replacementBatchIds = new Set(
      casterReworks.filter(r => r.replacement_batch_id !== null).map(r => r.replacement_batch_id as number)
    );

    const casterBatches = (await db.select().from(batches).where(eq(batches.caster_id, casterId)))
      .filter(b => !replacementBatchIds.has(b.id));
    const allItems = await db.select().from(items);
    const itemMap = new Map(allItems.map(i => [i.id, i]));

    // Rework metal is derived from defective-piece weight (quantity_defective x
    // that SKU's own weight), not a separately-entered dispatch — one source
    // of truth instead of two logs that can silently disagree.
    const totalReworkKgSent = casterReworks.reduce((sum, r) => {
      const item = itemMap.get(r.item_id);
      if (!item || item.unit_weight_kg === null || item.unit_weight_kg === undefined) return sum;
      return sum + r.quantity_defective * item.unit_weight_kg;
    }, 0);

    let totalFinishedWeightKgReceived = 0;
    let expectedMetalConsumedKg = 0;
    let hasWeighableBatch = false;
    let actualPieceCount = 0;
    const missingItemIds = new Set<number>();

    for (const batch of casterBatches) {
      actualPieceCount += batch.quantity_produced;
      const item = itemMap.get(batch.item_id);
      if (!item || item.unit_weight_kg === null || item.unit_weight_kg === undefined) {
        if (item) missingItemIds.add(item.id);
        continue;
      }
      const batchWeightKg = batch.quantity_produced * item.unit_weight_kg;
      totalFinishedWeightKgReceived += batchWeightKg;

      const wastagePct = await this.resolveBlendedWastagePct(casterId, item.id, totalIngotKgSent, totalScrapKgSent);
      expectedMetalConsumedKg += batchWeightKg / (1 - wastagePct / 100);
      hasWeighableBatch = true;
    }

    const itemsMissingWeight = Array.from(missingItemIds).map(id => ({
      itemId: id,
      itemName: itemMap.get(id)?.name || `Item #${id}`,
    }));

    const varianceKg = hasWeighableBatch ? totalMetalKgSent - expectedMetalConsumedKg : null;
    const variancePercent = varianceKg !== null && totalMetalKgSent > 0 ? (varianceKg / totalMetalKgSent) * 100 : null;

    const piecesSent = casterReworks.reduce((sum, r) => sum + r.quantity_defective, 0);
    const piecesReplaced = casterReworks.reduce((sum, r) => sum + r.quantity_replaced, 0);

    return {
      totalIngotKgSent,
      totalScrapKgSent,
      totalMetalKgSent,
      totalFinishedWeightKgReceived,
      expectedMetalConsumedKg: hasWeighableBatch ? expectedMetalConsumedKg : null,
      varianceKg,
      variancePercent,
      actualPieceCount,
      itemsMissingWeight,
      rework: {
        totalReworkKgSent,
        piecesSent,
        piecesReplaced,
        piecesPending: piecesSent - piecesReplaced,
      },
    };
  }

  // --- Dies ---
  async getAllDies(): Promise<Die[]> {
    return await db.select().from(dies);
  }
  async getDieById(id: number): Promise<Die | undefined> {
    const [d] = await db.select().from(dies).where(eq(dies.id, id));
    return d;
  }
  async getDiesByCasterId(casterId: number): Promise<Die[]> {
    return await db.select().from(dies).where(eq(dies.caster_id, casterId));
  }
  async createDie(die: InsertDie): Promise<Die> {
    const [created] = await db.insert(dies).values(die).returning();
    return created;
  }
  async updateDie(id: number, die: Partial<InsertDie>): Promise<Die | undefined> {
    const [updated] = await db.update(dies).set(die).where(eq(dies.id, id)).returning();
    return updated;
  }
  async deleteDie(id: number): Promise<void> {
    await db.delete(dies).where(eq(dies.id, id));
  }

  // --- Reworks ---
  async getAllReworks(): Promise<Rework[]> {
    return await db.select().from(reworks).orderBy(desc(reworks.sent_date));
  }
  async getReworkById(id: number): Promise<Rework | undefined> {
    const [r] = await db.select().from(reworks).where(eq(reworks.id, id));
    return r;
  }
  async getReworksByCasterId(casterId: number): Promise<Rework[]> {
    return await db.select().from(reworks).where(eq(reworks.caster_id, casterId)).orderBy(desc(reworks.sent_date));
  }
  async createRework(rework: InsertRework): Promise<Rework> {
    const [created] = await db.insert(reworks).values(rework).returning();
    return created;
  }
  async updateRework(id: number, rework: Partial<InsertRework>): Promise<Rework | undefined> {
    const [updated] = await db.update(reworks).set(rework).where(eq(reworks.id, id)).returning();
    return updated;
  }
  async deleteRework(id: number): Promise<void> {
    await db.delete(reworks).where(eq(reworks.id, id));
  }

  // --- Vendor metal statements ---
  async getAllVendorMetalStatements(): Promise<VendorMetalStatement[]> {
    return await db.select().from(vendorMetalStatements).orderBy(desc(vendorMetalStatements.period_month));
  }
  async getVendorMetalStatementsByCasterId(casterId: number): Promise<VendorMetalStatement[]> {
    return await db.select().from(vendorMetalStatements)
      .where(eq(vendorMetalStatements.caster_id, casterId))
      .orderBy(desc(vendorMetalStatements.period_month));
  }
  async createVendorMetalStatement(s: InsertVendorMetalStatement): Promise<VendorMetalStatement> {
    const [created] = await db.insert(vendorMetalStatements).values(s).returning();
    return created;
  }
  async updateVendorMetalStatement(id: number, s: Partial<InsertVendorMetalStatement>): Promise<VendorMetalStatement | undefined> {
    const [updated] = await db.update(vendorMetalStatements).set(s).where(eq(vendorMetalStatements.id, id)).returning();
    return updated;
  }
  async deleteVendorMetalStatement(id: number): Promise<void> {
    await db.delete(vendorMetalStatements).where(eq(vendorMetalStatements.id, id));
  }

  async calculateMetalStatementForPeriod(casterId: number, periodMonth: string): Promise<{
    openingBalanceKg: number;
    dispatchedKg: number;
    expectedMetalConsumedKg: number;
    actualFinishedWeightKg: number;
    closingBalanceKg: number;
    itemsMissingWeight: Array<{ itemId: number; itemName: string }>;
  }> {
    // "As of end of periodMonth" cutoff — first day of the FOLLOWING month
    const [year, month] = periodMonth.split("-").map(Number);
    const periodEndExclusive = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const periodStart = `${periodMonth}-01`;

    const balanceAsOf = async (cutoffExclusive: string) => {
      const dispatches = (await this.getIngotDispatchesByCasterId(casterId))
        .filter(d => d.material_type !== 'rework' && d.dispatch_date < cutoffExclusive);
      const ingotKg = dispatches.filter(d => d.material_type === 'ingot').reduce((sum, d) => sum + d.quantity_kg, 0);
      const scrapKg = dispatches.filter(d => d.material_type === 'scrap').reduce((sum, d) => sum + d.quantity_kg, 0);
      const dispatchedKg = ingotKg + scrapKg;

      const casterReworks = await this.getReworksByCasterId(casterId);
      const replacementBatchIds = new Set(
        casterReworks.filter(r => r.replacement_batch_id !== null).map(r => r.replacement_batch_id as number)
      );

      const casterBatches = (await db.select().from(batches).where(eq(batches.caster_id, casterId)))
        .filter(b => !replacementBatchIds.has(b.id) && b.received_date < cutoffExclusive);
      const allItems = await db.select().from(items);
      const itemMap = new Map(allItems.map(i => [i.id, i]));

      let actualFinishedWeightKg = 0;
      let expectedMetalConsumedKg = 0;
      const missingItemIds = new Set<number>();
      for (const batch of casterBatches) {
        const item = itemMap.get(batch.item_id);
        if (!item || item.unit_weight_kg === null || item.unit_weight_kg === undefined) {
          if (item) missingItemIds.add(item.id);
          continue;
        }
        const weightKg = batch.quantity_produced * item.unit_weight_kg;
        actualFinishedWeightKg += weightKg;
        const wastagePct = await this.resolveBlendedWastagePct(casterId, item.id, ingotKg, scrapKg);
        expectedMetalConsumedKg += weightKg / (1 - wastagePct / 100);
      }

      const itemsMissingWeight = Array.from(missingItemIds).map(id => ({
        itemId: id,
        itemName: itemMap.get(id)?.name || `Item #${id}`,
      }));

      // Balance = metal dispatched minus the wastage-adjusted metal-equivalent
      // of what's actually been produced so far — NOT minus raw finished
      // weight, since wastage naturally makes finished weight < metal sent
      // even when nothing is actually outstanding.
      return {
        dispatchedKg,
        actualFinishedWeightKg,
        expectedMetalConsumedKg,
        balanceKg: dispatchedKg - expectedMetalConsumedKg,
        itemsMissingWeight,
      };
    };

    const opening = await balanceAsOf(periodStart);
    const closing = await balanceAsOf(periodEndExclusive);

    return {
      openingBalanceKg: opening.balanceKg,
      dispatchedKg: closing.dispatchedKg - opening.dispatchedKg,
      expectedMetalConsumedKg: closing.expectedMetalConsumedKg - opening.expectedMetalConsumedKg,
      actualFinishedWeightKg: closing.actualFinishedWeightKg - opening.actualFinishedWeightKg,
      closingBalanceKg: closing.balanceKg,
      // Missing-weight items as of period end — the more complete picture
      itemsMissingWeight: closing.itemsMissingWeight,
    };
  }

  // --- BOM components ---
  async getAllBomComponents(): Promise<BomComponent[]> {
    return await db.select().from(bomComponents);
  }
  async getBomComponentsByParentId(parentItemId: number): Promise<BomComponent[]> {
    return await db.select().from(bomComponents).where(eq(bomComponents.parent_item_id, parentItemId));
  }
  async createBomComponent(c: InsertBomComponent): Promise<BomComponent> {
    const [created] = await db.insert(bomComponents).values(c).returning();
    return created;
  }
  async updateBomComponent(id: number, c: Partial<InsertBomComponent>): Promise<BomComponent | undefined> {
    const [updated] = await db.update(bomComponents).set(c).where(eq(bomComponents.id, id)).returning();
    return updated;
  }
  async deleteBomComponent(id: number): Promise<void> {
    await db.delete(bomComponents).where(eq(bomComponents.id, id));
  }
  async deleteBomComponentsByParentId(parentItemId: number): Promise<void> {
    await db.delete(bomComponents).where(eq(bomComponents.parent_item_id, parentItemId));
  }

  /**
   * Ships quantityKits worth of a kit item by decomposing its BOM: for each
   * item-type component, FIFO-deducts from that component's active batches
   * (oldest received_date first, same pattern as adjustBatchQuantities);
   * for each accessory-type component, decrements accessories.stock_on_hand.
   * Throws if any component doesn't have enough stock, before making any
   * changes (checked in a first pass) so partial deductions can't happen.
   */
  async shipKitComponents(parentItemId: number, quantityKits: number, shipmentDate: string): Promise<{
    itemDeductions: Array<{ itemId: number; itemName: string; quantityDeducted: number }>;
    accessoryDeductions: Array<{ accessoryId: number; accessoryName: string; quantityDeducted: number }>;
    allocations: Array<{
      component_type: "item" | "accessory";
      component_item_id?: number;
      component_accessory_id?: number;
      batch_id?: number;
      quantity: number;
    }>;
  }> {
    const components = await this.getBomComponentsByParentId(parentItemId);
    if (components.length === 0) {
      throw new Error(`No BOM defined for kit item #${parentItemId}`);
    }

    const allItems = await db.select().from(items);
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const allAccessories = await db.select().from(accessories);
    const accessoryMap = new Map(allAccessories.map(a => [a.id, a]));

    // First pass: verify enough stock exists for every component
    for (const c of components) {
      const needed = c.qty_per_kit * quantityKits;
      if (c.component_type === "item" && c.component_item_id) {
        const activeBatches = await this.getActiveBatchesByItemId(c.component_item_id);
        const available = activeBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
        if (available < needed) {
          const name = itemMap.get(c.component_item_id)?.name || `Item #${c.component_item_id}`;
          throw new Error(`Not enough stock of "${name}" to assemble ${quantityKits} kit(s): need ${needed}, have ${available}`);
        }
      } else if (c.component_type === "accessory" && c.component_accessory_id) {
        const acc = accessoryMap.get(c.component_accessory_id);
        if (!acc || acc.stock_on_hand < needed) {
          const name = acc?.name || `Accessory #${c.component_accessory_id}`;
          throw new Error(`Not enough stock of "${name}" to assemble ${quantityKits} kit(s): need ${needed}, have ${acc?.stock_on_hand ?? 0}`);
        }
      }
    }

    const itemDeductions: Array<{ itemId: number; itemName: string; quantityDeducted: number }> = [];
    const accessoryDeductions: Array<{ accessoryId: number; accessoryName: string; quantityDeducted: number }> = [];
    const allocations: Array<{
      component_type: "item" | "accessory";
      component_item_id?: number;
      component_accessory_id?: number;
      batch_id?: number;
      quantity: number;
    }> = [];

    // Second pass: actually deduct, recording exactly which batch(es) absorbed
    // how much — this is what makes the shipment reversible later.
    for (const c of components) {
      const needed = c.qty_per_kit * quantityKits;
      if (c.component_type === "item" && c.component_item_id) {
        let remaining = needed;
        const activeBatches = (await this.getActiveBatchesByItemId(c.component_item_id))
          .sort((a, b) => a.received_date.localeCompare(b.received_date)); // FIFO
        for (const batch of activeBatches) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, batch.quantity_remaining);
          if (take <= 0) continue;
          await this.adjustBatchQuantities(batch.batch_number, { shipped: take });
          allocations.push({
            component_type: "item",
            component_item_id: c.component_item_id,
            batch_id: batch.id,
            quantity: take,
          });
          remaining -= take;
        }
        itemDeductions.push({
          itemId: c.component_item_id,
          itemName: itemMap.get(c.component_item_id)?.name || `Item #${c.component_item_id}`,
          quantityDeducted: needed,
        });
      } else if (c.component_type === "accessory" && c.component_accessory_id) {
        const acc = accessoryMap.get(c.component_accessory_id);
        if (acc) {
          await db.update(accessories)
            .set({ stock_on_hand: acc.stock_on_hand - needed })
            .where(eq(accessories.id, acc.id));
          allocations.push({
            component_type: "accessory",
            component_accessory_id: acc.id,
            quantity: needed,
          });
          accessoryDeductions.push({
            accessoryId: acc.id,
            accessoryName: acc.name,
            quantityDeducted: needed,
          });
        }
      }
    }

    return { itemDeductions, accessoryDeductions, allocations };
  }

  async reverseKitShipmentAllocations(shipmentId: number): Promise<void> {
    const allocations = await db.select().from(kitShipmentAllocations)
      .where(eq(kitShipmentAllocations.shipment_id, shipmentId));

    for (const a of allocations) {
      if (a.component_type === "item" && a.batch_id) {
        const [batch] = await db.select().from(batches).where(eq(batches.id, a.batch_id));
        if (batch) {
          const restoredRemaining = batch.quantity_remaining + a.quantity;
          await db.update(batches)
            .set({ quantity_remaining: restoredRemaining, is_depleted: restoredRemaining <= 0 })
            .where(eq(batches.id, a.batch_id));
        }
      } else if (a.component_type === "accessory" && a.component_accessory_id) {
        const [acc] = await db.select().from(accessories).where(eq(accessories.id, a.component_accessory_id));
        if (acc) {
          await db.update(accessories)
            .set({ stock_on_hand: acc.stock_on_hand + a.quantity })
            .where(eq(accessories.id, acc.id));
        }
      }
    }

    await db.delete(kitShipmentAllocations).where(eq(kitShipmentAllocations.shipment_id, shipmentId));
  }

  // --- Accessories ordered directly on an order (not via a kit's BOM) ---
  async getOrderAccessoryItemsByOrderId(orderId: number): Promise<OrderAccessoryItem[]> {
    return await db.select().from(orderAccessoryItems).where(eq(orderAccessoryItems.order_id, orderId));
  }

  async createOrderAccessoryItem(item: InsertOrderAccessoryItem): Promise<OrderAccessoryItem> {
    const [created] = await db.insert(orderAccessoryItems).values(item).returning();
    return created;
  }

  async updateOrderAccessoryItem(id: number, item: Partial<InsertOrderAccessoryItem>): Promise<OrderAccessoryItem | undefined> {
    const [updated] = await db.update(orderAccessoryItems).set(item).where(eq(orderAccessoryItems.id, id)).returning();
    return updated;
  }

  async deleteOrderAccessoryItem(id: number): Promise<void> {
    await db.delete(orderAccessoryItems).where(eq(orderAccessoryItems.id, id));
  }

  async getOrderAccessoryShipmentsByOrderId(orderId: number): Promise<OrderAccessoryShipment[]> {
    return await db.select().from(orderAccessoryShipments).where(eq(orderAccessoryShipments.order_id, orderId));
  }

  async createOrderAccessoryShipment(shipment: InsertOrderAccessoryShipment): Promise<OrderAccessoryShipment> {
    const [acc] = await db.select().from(accessories).where(eq(accessories.id, shipment.accessory_id));
    if (!acc) {
      throw new Error(`Accessory #${shipment.accessory_id} not found`);
    }
    if (acc.stock_on_hand < shipment.quantity_shipped) {
      throw new Error(`Not enough stock of "${acc.name}": need ${shipment.quantity_shipped}, have ${acc.stock_on_hand}`);
    }

    const [created] = await db.insert(orderAccessoryShipments).values(shipment).returning();
    await db.update(accessories)
      .set({ stock_on_hand: acc.stock_on_hand - shipment.quantity_shipped })
      .where(eq(accessories.id, acc.id));
    return created;
  }

  async deleteOrderAccessoryShipment(id: number): Promise<void> {
    const [shipment] = await db.select().from(orderAccessoryShipments).where(eq(orderAccessoryShipments.id, id));
    if (!shipment) return;

    const [acc] = await db.select().from(accessories).where(eq(accessories.id, shipment.accessory_id));
    if (acc) {
      await db.update(accessories)
        .set({ stock_on_hand: acc.stock_on_hand + shipment.quantity_shipped })
        .where(eq(accessories.id, acc.id));
    }
    await db.delete(orderAccessoryShipments).where(eq(orderAccessoryShipments.id, id));
  }

  // --- Order component summary (kit decomposition for planning/visibility) ---
  async getOrderComponentSummary(orderId: number): Promise<{
    items: Array<{ itemId: number; itemName: string; quantity: number }>;
    accessories: Array<{ accessoryId: number; accessoryName: string; quantity: number }>;
  }> {
    const orderLineItems = await this.getOrderItemsByOrderId(orderId);
    const orderAccItems = await this.getOrderAccessoryItemsByOrderId(orderId);
    const allItems = await db.select().from(items);
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const allAccessories = await db.select().from(accessories);
    const accessoryMap = new Map(allAccessories.map(a => [a.id, a]));

    const itemTotals = new Map<number, number>();
    const accessoryTotals = new Map<number, number>();

    for (const li of orderLineItems) {
      const item = itemMap.get(li.item_id);
      if (!item) continue;
      if (item.is_kit) {
        const components = await this.getBomComponentsByParentId(item.id);
        for (const c of components) {
          const qty = c.qty_per_kit * li.quantity;
          if (c.component_type === "item" && c.component_item_id) {
            itemTotals.set(c.component_item_id, (itemTotals.get(c.component_item_id) || 0) + qty);
          } else if (c.component_type === "accessory" && c.component_accessory_id) {
            accessoryTotals.set(c.component_accessory_id, (accessoryTotals.get(c.component_accessory_id) || 0) + qty);
          }
        }
      } else {
        itemTotals.set(item.id, (itemTotals.get(item.id) || 0) + li.quantity);
      }
    }

    for (const ai of orderAccItems) {
      accessoryTotals.set(ai.accessory_id, (accessoryTotals.get(ai.accessory_id) || 0) + ai.quantity);
    }

    return {
      items: Array.from(itemTotals.entries()).map(([itemId, quantity]) => ({
        itemId,
        itemName: itemMap.get(itemId)?.name || `Item #${itemId}`,
        quantity,
      })),
      accessories: Array.from(accessoryTotals.entries()).map(([accessoryId, quantity]) => ({
        accessoryId,
        accessoryName: accessoryMap.get(accessoryId)?.name || `Accessory #${accessoryId}`,
        quantity,
      })),
    };
  }

  // --- Projections (manual, for casters — not derived from orders/stock) ---
  async getProjectionsByMonth(month: string): Promise<Projection[]> {
    return await db.select().from(projections).where(eq(projections.month, month));
  }

  async upsertProjection(itemId: number, month: string, quantity: number, notes?: string | null): Promise<Projection> {
    const [existing] = await db.select().from(projections)
      .where(and(eq(projections.item_id, itemId), eq(projections.month, month)));
    if (existing) {
      const [updated] = await db.update(projections)
        .set({ quantity, notes: notes ?? existing.notes })
        .where(eq(projections.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(projections)
      .values({ item_id: itemId, month, quantity, notes: notes ?? null })
      .returning();
    return created;
  }

  // --- Coating conversions ---
  async getAllCoatingConversions(): Promise<CoatingConversion[]> {
    return await db.select().from(coatingConversions).orderBy(desc(coatingConversions.sent_date));
  }

  async getCoatingConversionById(id: number): Promise<CoatingConversion | undefined> {
    const [c] = await db.select().from(coatingConversions).where(eq(coatingConversions.id, id));
    return c;
  }

  /**
   * Sends bare castings for coating: deducts from the bare item's active
   * batches (FIFO), recording exactly which batch(es) were drawn from (via
   * coating_conversion_allocations) so this is reversible on delete — same
   * pattern as kit shipments. Creates the conversion in 'pending' status;
   * nothing happens to the coated item's stock until receiveCoatingConversion
   * is called.
   */
  async createCoatingConversion(data: InsertCoatingConversion): Promise<CoatingConversion> {
    const activeBatches = (await this.getActiveBatchesByItemId(data.bare_item_id))
      .sort((a, b) => a.received_date.localeCompare(b.received_date)); // FIFO
    const available = activeBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
    if (available < data.quantity_sent) {
      const [bareItem] = await db.select().from(items).where(eq(items.id, data.bare_item_id));
      throw new Error(`Not enough stock of "${bareItem?.name || 'bare item'}" to send for coating: need ${data.quantity_sent}, have ${available}`);
    }

    const [created] = await db.insert(coatingConversions).values(data).returning();

    let remaining = data.quantity_sent;
    for (const batch of activeBatches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.quantity_remaining);
      if (take <= 0) continue;
      await this.adjustBatchQuantities(batch.batch_number, { shipped: take });
      await db.insert(coatingConversionAllocations).values({
        coating_conversion_id: created.id,
        batch_id: batch.id,
        quantity: take,
      });
      remaining -= take;
    }

    return created;
  }

  /**
   * Records what came back from coating: creates a new batch for the coated
   * item (quantity_received/rejected/produced/remaining, same shape as any
   * other batch), links it back to the conversion, marks the conversion
   * 'received'. Rejections here are Onyx's own QC on the way back — separate
   * from whatever the caster rejected when the bare casting was first made.
   */
  async receiveCoatingConversion(
    id: number,
    data: { quantity_received: number; quantity_rejected: number; received_date: string; color?: string | null }
  ): Promise<CoatingConversion> {
    const conversion = await this.getCoatingConversionById(id);
    if (!conversion) {
      throw new Error(`Coating conversion #${id} not found`);
    }
    if (conversion.status === "received") {
      throw new Error("This conversion has already been received");
    }

    const quantityProduced = data.quantity_received - data.quantity_rejected;
    if (quantityProduced < 0) {
      throw new Error("Rejected quantity cannot exceed received quantity");
    }

    const batchNumber = `CC${conversion.id}-${data.received_date.replace(/-/g, "")}`;
    const [outputBatch] = await db.insert(batches).values({
      item_id: conversion.coated_item_id,
      caster_id: conversion.caster_id,
      batch_number: batchNumber,
      received_date: data.received_date,
      quantity_received: data.quantity_received,
      quantity_rejected: data.quantity_rejected,
      quantity_produced: quantityProduced,
      quantity_remaining: quantityProduced,
      quality_status: "Good",
      color: data.color ?? conversion.color ?? null,
      notes: `From coating conversion #${conversion.id}`,
    }).returning();

    const [updated] = await db.update(coatingConversions)
      .set({
        quantity_received: data.quantity_received,
        quantity_rejected: data.quantity_rejected,
        received_date: data.received_date,
        color: data.color ?? conversion.color,
        output_batch_id: outputBatch.id,
        status: "received",
      })
      .where(eq(coatingConversions.id, id))
      .returning();

    return updated;
  }

  /**
   * Reverses a coating conversion: restores the bare batches it drew from
   * (via its allocations), and if it was already received, removes the
   * output batch too — unless some of that output has already shipped, in
   * which case deletion is blocked rather than silently corrupting stock.
   */
  async deleteCoatingConversion(id: number): Promise<void> {
    const conversion = await this.getCoatingConversionById(id);
    if (!conversion) return;

    if (conversion.output_batch_id) {
      const [outputBatch] = await db.select().from(batches).where(eq(batches.id, conversion.output_batch_id));
      if (outputBatch && outputBatch.quantity_remaining !== outputBatch.quantity_produced) {
        throw new Error(
          "Cannot delete this conversion — some of the coated stock it produced has already been shipped. " +
          "Reverse those shipments first."
        );
      }
    }

    const allocations = await db.select().from(coatingConversionAllocations)
      .where(eq(coatingConversionAllocations.coating_conversion_id, id));
    for (const a of allocations) {
      const [batch] = await db.select().from(batches).where(eq(batches.id, a.batch_id));
      if (batch) {
        const restoredRemaining = batch.quantity_remaining + a.quantity;
        await db.update(batches)
          .set({ quantity_remaining: restoredRemaining, is_depleted: restoredRemaining <= 0 })
          .where(eq(batches.id, a.batch_id));
      }
    }
    await db.delete(coatingConversionAllocations).where(eq(coatingConversionAllocations.coating_conversion_id, id));

    if (conversion.output_batch_id) {
      await db.delete(batches).where(eq(batches.id, conversion.output_batch_id));
    }

    await db.delete(coatingConversions).where(eq(coatingConversions.id, id));
  }
}

export const storage = new DbStorage();
