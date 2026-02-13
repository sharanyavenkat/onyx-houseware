import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyPassword } from "./auth";
import { requireAuth, requireAdmin } from "./middleware";
import { insertItemSchema, insertCustomerSchema, insertOrderSchema, insertOrderItemSchema, insertIndentSchema, insertShipmentSchema, insertBatchSchema, updateBatchSchema, insertInvoiceSchema, insertAccessorySchema, insertCasterSchema, insertPurchaseOrderSchema, insertPurchaseOrderItemSchema } from "@shared/schema";
import { db } from "./db/client";
import { batches } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes (public) - must come before the auth middleware
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const isValid = await verifyPassword(password, user.password);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session with user role for access control
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      res.json({
        id: user.id,
        username: user.username,
        role: user.role
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        role: user.role
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Protect all /api routes except /api/auth routes
  app.use("/api", (req, res, next) => {
    // Skip authentication for auth routes
    if (req.path.startsWith("/auth")) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  // Block mutations for viewer role (all POST, PATCH, DELETE except auth routes)
  app.use("/api", (req, res, next) => {
    // Skip for auth routes
    if (req.path.startsWith("/auth")) {
      return next();
    }
    // Skip for GET requests (read-only)
    if (req.method === "GET") {
      return next();
    }
    // Check admin role for mutations
    return requireAdmin(req, res, next);
  });

  // Items routes
  app.get("/api/items", async (req, res) => {
    try {
      const items = await storage.getAllItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const item = await storage.getItemById(parseInt(req.params.id));
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const validatedData = insertItemSchema.parse(req.body);
      const item = await storage.createItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
    try {
      const item = await storage.updateItem(parseInt(req.params.id), req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      
      // Check what references this item before attempting deletion
      const references = await storage.getItemReferences(itemId);
      
      // Only block deletion for orders and batches - indents will be auto-deleted
      if (references.orderItems > 0 || references.batches > 0) {
        const parts = [];
        if (references.orderItems > 0) parts.push(`${references.orderItems} order line(s)`);
        if (references.batches > 0) parts.push(`${references.batches} batch(es)`);
        
        return res.status(400).json({ 
          message: `Cannot delete this item because it is referenced by: ${parts.join(", ")}. Please remove these references first.`
        });
      }
      
      // Auto-delete any indent records for this item (they're just planning data)
      await storage.deleteIndentsByItemId(itemId);
      
      // Now delete the item
      await storage.deleteItem(itemId);
      res.status(204).send();
    } catch (error: any) {
      // Fallback for any other foreign key constraint errors
      if (error.message && error.message.toLowerCase().includes('foreign key constraint')) {
        return res.status(400).json({ 
          message: "Cannot delete this item because it is referenced by other data. Please remove related data first." 
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Batch routes
  // Get on-hand stock from batches (must come before general /api/batches route)
  app.get("/api/batches/on-hand-stock", async (req, res) => {
    try {
      // Support optional includeAcceptable query parameter (default true)
      const includeAcceptable = req.query.includeAcceptable !== 'false';
      const onHandStock = await storage.getOnHandStockByItemWithQuality(includeAcceptable);
      res.json(onHandStock);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/orders/pending-by-item", async (req, res) => {
    try {
      const pendingOrders = await storage.getPendingOrdersByItem();
      res.json(pendingOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batches/rejected-by-item", async (req, res) => {
    try {
      const rejectedQuantities = await storage.getRejectedQuantitiesByItem();
      res.json(rejectedQuantities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batches", async (req, res) => {
    try {
      const batches = await storage.getAllBatches();
      // Add calculated quantity_shipped field to each batch
      // shipped = produced - remaining (rejections already subtracted from produced during QC)
      const enrichedBatches = batches.map(batch => ({
        ...batch,
        quantity_shipped: batch.quantity_produced - batch.quantity_remaining
      }));
      res.json(enrichedBatches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batches/by-item/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const batches = await storage.getBatchesByItemId(itemId);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batches/active/by-item/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const batches = await storage.getActiveBatchesByItemId(itemId);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a specific batch by batch_number (for editing shipments with depleted batches)
  app.get("/api/batches/by-number/:batchNumber", async (req, res) => {
    try {
      const batchNumber = req.params.batchNumber;
      const batch = await storage.getBatchByNumber(batchNumber);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      res.json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Monthly castings report: batches received per caster per item for a given month
  app.get("/api/batches/monthly-report", async (req, res) => {
    try {
      const { month } = req.query; // format: YYYY-MM
      if (!month || typeof month !== 'string') {
        return res.status(400).json({ message: "Month parameter required (YYYY-MM)" });
      }

      const allBatches = await storage.getAllBatches();
      const allItems = await storage.getAllItems();

      const itemMap = new Map(allItems.map(i => [i.id, i.name]));

      // Filter batches by month and that have a caster
      // Use string slicing to avoid timezone issues with Date parsing
      const filtered = allBatches.filter(b => {
        if (!b.caster_id || !b.received_date) return false;
        const batchMonth = b.received_date.slice(0, 7);
        return batchMonth === month;
      });

      // Group by caster_id, then by item_id
      const report: Record<number, { item_id: number; item_name: string; qty_received: number; qty_produced: number; qty_rejected: number; batch_count: number }[]> = {};

      filtered.forEach(b => {
        const casterId = b.caster_id!;
        if (!report[casterId]) report[casterId] = [];

        const existing = report[casterId].find(r => r.item_id === b.item_id);
        if (existing) {
          existing.qty_received += b.quantity_received;
          existing.qty_produced += b.quantity_produced;
          existing.qty_rejected += b.quantity_rejected;
          existing.batch_count += 1;
        } else {
          report[casterId].push({
            item_id: b.item_id,
            item_name: itemMap.get(b.item_id) || "Unknown",
            qty_received: b.quantity_received,
            qty_produced: b.quantity_produced,
            qty_rejected: b.quantity_rejected,
            batch_count: 1,
          });
        }
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batches", async (req, res) => {
    try {
      // Extract and validate required fields
      const requiredInput = {
        item_id: req.body.item_id,
        batch_number: req.body.batch_number,
        received_date: req.body.received_date
      };

      // Schema validation for required fields only
      const validated = insertBatchSchema.pick({
        item_id: true,
        batch_number: true,
        received_date: true
      }).parse(requiredInput);

      // Handle caster field (optional)
      const caster_id = req.body.caster_id ? parseInt(req.body.caster_id) : null;
      if (caster_id) {
        const caster = await storage.getCasterById(caster_id);
        if (!caster) {
          return res.status(404).json({ message: `Caster with ID ${caster_id} not found` });
        }
      }

      // Handle quantity fields
      const quantity_received = parseInt(req.body.quantity_received) || 0;
      const quantity_rejected = parseInt(req.body.quantity_rejected) || 0;
      
      // Calculate expected final qty (received - rejected)
      const expectedFinalQty = quantity_received - quantity_rejected;
      
      // If quantity_produced is provided and differs from expected, it's a manual override
      let quantity_produced: number;
      let is_manual_quantity = false;
      
      if (req.body.quantity_produced !== undefined && req.body.quantity_produced !== null && req.body.quantity_produced !== '') {
        quantity_produced = parseInt(req.body.quantity_produced);
        is_manual_quantity = quantity_produced !== expectedFinalQty;
      } else {
        quantity_produced = Math.max(0, expectedFinalQty);
      }

      // Handle optional fields
      const quality_status = req.body.quality_status ?? 'Good';
      const notes = req.body.notes ?? null;

      // Additional business rules validation
      if (quantity_produced < 0) {
        return res.status(400).json({ message: "Final quantity cannot be negative" });
      }
      if (quantity_received < 0) {
        return res.status(400).json({ message: "Received quantity cannot be negative" });
      }
      if (quantity_rejected < 0) {
        return res.status(400).json({ message: "Rejected quantity cannot be negative" });
      }

      // Validate ISO date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(validated.received_date)) {
        return res.status(400).json({ message: "Received date must be in ISO format (YYYY-MM-DD)" });
      }

      // Validate quality status enum
      const validStatuses = ['Good', 'Acceptable', 'Rejected'];
      if (!validStatuses.includes(quality_status)) {
        return res.status(400).json({ message: "Quality status must be Good, Acceptable, or Rejected" });
      }

      // Verify that the referenced item exists
      const item = await storage.getItemById(validated.item_id);
      if (!item) {
        return res.status(404).json({ message: `Item with ID ${validated.item_id} not found` });
      }

      // Compute derived fields server-side
      // For new batches: remaining = produced (no shipments yet)
      const batchData = {
        item_id: validated.item_id,
        caster_id: caster_id,
        batch_number: validated.batch_number,
        received_date: validated.received_date,
        quantity_received: quantity_received,
        quantity_rejected: quantity_rejected,
        quantity_produced: quantity_produced,
        quantity_remaining: quantity_produced,  // Server-computed (no shipments yet)
        is_manual_quantity: is_manual_quantity,
        quality_status: quality_status,
        is_depleted: quantity_produced === 0,
        notes: notes
      };

      // Handle purchase_order_id if provided
      const purchase_order_id = req.body.purchase_order_id ? parseInt(req.body.purchase_order_id) : null;

      // Create batch
      const batch = await storage.createBatch({
        ...batchData,
        purchase_order_id,
      });
      
      // Auto-update purchase order received quantities if linked
      if (purchase_order_id) {
        await storage.recalculatePurchaseOrderReceived(purchase_order_id);
        await storage.checkAndAutoCompletePurchaseOrder(purchase_order_id);
      }
      
      res.status(201).json(batch);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: "Batch number already exists" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/batches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate payload with Zod schema
      const validationResult = updateBatchSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid batch update data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Get the batch before update to check purchase_order_id
      const existingBatch = await storage.getBatchById(id);
      
      // Use unified storage.updateBatch method
      const updatedBatch = await storage.updateBatch(id, validationResult.data);
      
      // Handle purchase_order_id update if provided in body
      if (req.body.purchase_order_id !== undefined) {
        const newPoId = req.body.purchase_order_id ? parseInt(req.body.purchase_order_id) : null;
        await db.update(batches).set({ purchase_order_id: newPoId }).where(eq(batches.id, id));
        
        // Recalculate old PO if batch was previously linked
        if (existingBatch?.purchase_order_id && existingBatch.purchase_order_id !== newPoId) {
          await storage.recalculatePurchaseOrderReceived(existingBatch.purchase_order_id);
          await storage.checkAndAutoCompletePurchaseOrder(existingBatch.purchase_order_id);
        }
        // Recalculate new PO
        if (newPoId) {
          await storage.recalculatePurchaseOrderReceived(newPoId);
          await storage.checkAndAutoCompletePurchaseOrder(newPoId);
        }
      } else if (existingBatch?.purchase_order_id) {
        // If batch quantities changed, recalculate linked PO
        await storage.recalculatePurchaseOrderReceived(existingBatch.purchase_order_id);
        await storage.checkAndAutoCompletePurchaseOrder(existingBatch.purchase_order_id);
      }
      
      return res.json(updatedBatch);
    } catch (error: any) {
      if (error.code === 'BATCH_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
      }
      if (error.code === 'INVARIANT_VIOLATION' || error.code === 'INVALID_REJECTED_QUANTITY') {
        return res.status(422).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/batches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const batch = await storage.getBatchById(id);
      const poId = batch?.purchase_order_id;
      
      await storage.deleteBatch(id);
      
      if (poId) {
        await storage.recalculatePurchaseOrderReceived(poId);
        await storage.checkAndAutoCompletePurchaseOrder(poId);
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/batches/:id/rejection", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity_rejected, quality_status, notes } = req.body;

      // Validate quantity_rejected
      if (typeof quantity_rejected !== 'number' || quantity_rejected < 0) {
        return res.status(400).json({ message: "quantity_rejected must be a non-negative number" });
      }

      // Validate quality_status if provided
      if (quality_status !== undefined && !['Good', 'Acceptable', 'Rejected'].includes(quality_status)) {
        return res.status(400).json({ message: "quality_status must be Good, Acceptable, or Rejected" });
      }

      const batch = await storage.updateBatchRejection(id, quantity_rejected, quality_status, notes);
      res.json(batch);
    } catch (error: any) {
      // Map storage errors to HTTP status codes
      if (error.code === 'BATCH_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
      }
      if (error.code === 'INSUFFICIENT_QUANTITY' || error.code === 'INVALID_REJECTED_QUANTITY' || error.code === 'INVARIANT_VIOLATION') {
        return res.status(422).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batches/:batchNumber/adjust", async (req, res) => {
    try {
      const { batchNumber } = req.params;
      const { shipped, rejected } = req.body;

      // Validate adjustment quantities
      if (shipped !== undefined && (typeof shipped !== 'number' || shipped < 0)) {
        return res.status(400).json({ message: "Shipped quantity must be a non-negative number" });
      }
      if (rejected !== undefined && (typeof rejected !== 'number' || rejected < 0)) {
        return res.status(400).json({ message: "Rejected quantity must be a non-negative number" });
      }
      if (!shipped && !rejected) {
        return res.status(400).json({ message: "At least one of shipped or rejected must be provided" });
      }

      const batch = await storage.adjustBatchQuantities(batchNumber, { shipped, rejected });
      res.json(batch);
    } catch (error: any) {
      // Map storage errors to HTTP status codes
      if (error.code === 'BATCH_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
      }
      if (error.code === 'INSUFFICIENT_QUANTITY' || error.code === 'INVALID_ADJUSTMENT' || error.code === 'INVARIANT_VIOLATION') {
        return res.status(422).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Customers routes
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomerById(parseInt(req.params.id));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(parseInt(req.params.id), req.body);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      // Check if it's a foreign key constraint error (case-insensitive)
      if (error.message && error.message.toLowerCase().includes('foreign key constraint')) {
        return res.status(400).json({ 
          message: "Cannot delete this customer because they have existing orders. Please delete their orders first." 
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Orders routes
  app.get("/api/orders", async (req, res) => {
    try {
      const allOrders = await storage.getAllOrders();
      const customers = await storage.getAllCustomers();
      const items = await storage.getAllItems();
      
      const ordersWithDetails = await Promise.all(
        allOrders.map(async (order) => {
          const customer = customers.find(c => c.id === order.customer_id);
          const orderItemsData = await storage.getOrderItemsByOrderId(order.id);
          
          const line_items = orderItemsData.map(oi => {
            const item = items.find(i => i.id === oi.item_id);
            return {
              order_item_id: oi.id,
              item_id: oi.item_id,
              item_name: item?.name || '',
              sku: item?.sku || '',
              quantity: oi.quantity
            };
          });

          return {
            ...order,
            customer_name: customer?.company_name || '',
            line_items
          };
        })
      );

      res.json(ordersWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrderById(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const customer = await storage.getCustomerById(order.customer_id);
      const orderItemsData = await storage.getOrderItemsByOrderId(order.id);
      const items = await storage.getAllItems();

      const line_items = orderItemsData.map(oi => {
        const item = items.find(i => i.id === oi.item_id);
        return {
          order_item_id: oi.id,
          item_id: oi.item_id,
          item_name: item?.name || '',
          sku: item?.sku || '',
          quantity: oi.quantity
        };
      });

      res.json({
        ...order,
        customer_name: customer?.company_name || '',
        line_items
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { line_items, ...orderData } = req.body;
      
      const validatedOrder = insertOrderSchema.parse(orderData);
      const order = await storage.createOrder(validatedOrder);

      if (line_items && line_items.length > 0) {
        for (const lineItem of line_items) {
          await storage.createOrderItem({
            order_id: order.id,
            item_id: lineItem.item_id,
            quantity: lineItem.quantity
          });
        }
      }

      const customer = await storage.getCustomerById(order.customer_id);
      const items = await storage.getAllItems();
      const orderItemsData = await storage.getOrderItemsByOrderId(order.id);

      const line_items_response = orderItemsData.map(oi => {
        const item = items.find(i => i.id === oi.item_id);
        return {
          order_item_id: oi.id,
          item_id: oi.item_id,
          item_name: item?.name || '',
          sku: item?.sku || '',
          quantity: oi.quantity
        };
      });

      res.status(201).json({
        ...order,
        customer_name: customer?.company_name || '',
        line_items: line_items_response
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const { line_items, ...orderData } = req.body;
      
      const order = await storage.updateOrder(parseInt(req.params.id), orderData);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (line_items) {
        const existingItems = await storage.getOrderItemsByOrderId(order.id);
        
        const newItemIds = line_items.map((li: any) => li.item_id);
        const existingItemIds = existingItems.map(ei => ei.item_id);
        
        for (const existingItem of existingItems) {
          const newLineItem = line_items.find((li: any) => li.item_id === existingItem.item_id);
          if (newLineItem) {
            if (newLineItem.quantity !== existingItem.quantity) {
              await storage.updateOrderItem(existingItem.id, { quantity: newLineItem.quantity });
            }
          } else {
            await storage.deleteOrderItem(existingItem.id);
          }
        }
        
        for (const lineItem of line_items) {
          if (!existingItemIds.includes(lineItem.item_id)) {
            await storage.createOrderItem({
              order_id: order.id,
              item_id: lineItem.item_id,
              quantity: lineItem.quantity
            });
          }
        }
      }

      const customer = await storage.getCustomerById(order.customer_id);
      const items = await storage.getAllItems();
      const orderItemsData = await storage.getOrderItemsByOrderId(order.id);

      const line_items_response = orderItemsData.map(oi => {
        const item = items.find(i => i.id === oi.item_id);
        return {
          order_item_id: oi.id,
          item_id: oi.item_id,
          item_name: item?.name || '',
          sku: item?.sku || '',
          quantity: oi.quantity
        };
      });

      res.json({
        ...order,
        customer_name: customer?.company_name || '',
        line_items: line_items_response
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      await storage.deleteOrder(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Order Items routes
  app.get("/api/order-items", async (req, res) => {
    try {
      const allOrderItems: any[] = [];
      const orders = await storage.getAllOrders();
      
      for (const order of orders) {
        const items = await storage.getOrderItemsByOrderId(order.id);
        allOrderItems.push(...items);
      }
      
      res.json(allOrderItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      const items = await storage.getOrderItemsByOrderId(parseInt(req.params.id));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/order-items", async (req, res) => {
    try {
      const validatedData = insertOrderItemSchema.parse(req.body);
      const orderItem = await storage.createOrderItem(validatedData);
      res.status(201).json(orderItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Indent routes
  app.get("/api/indents/:month", async (req, res) => {
    try {
      const indents = await storage.getIndentsByMonth(req.params.month);
      res.json(indents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/indents", async (req, res) => {
    try {
      console.log('[Server] POST /api/indents received body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertIndentSchema.parse(req.body);
      console.log('[Server] After Zod validation:', JSON.stringify(validatedData, null, 2));
      const indent = await storage.upsertIndent(validatedData);
      console.log('[Server] After upsert, returned indent:', JSON.stringify(indent, null, 2));
      res.status(200).json(indent);
    } catch (error: any) {
      console.log('[Server] Error in POST /api/indents:', error.message);
      res.status(400).json({ message: error.message });
    }
  });

  // Shipment routes
  app.get("/api/shipments/order/:orderId", async (req, res) => {
    try {
      const shipments = await storage.getShipmentsByOrderId(parseInt(req.params.orderId));
      res.json(shipments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/shipments/order-item/:orderItemId", async (req, res) => {
    try {
      const shipments = await storage.getShipmentsByOrderItemId(parseInt(req.params.orderItemId));
      res.json(shipments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/shipments", async (req, res) => {
    try {
      const validatedData = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(validatedData);
      res.status(201).json(shipment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/shipments/:id", async (req, res) => {
    try {
      const validatedData = insertShipmentSchema.partial().parse(req.body);
      const shipment = await storage.updateShipment(parseInt(req.params.id), validatedData);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      res.json(shipment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/shipments/:id", async (req, res) => {
    try {
      await storage.deleteShipment(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get next shipment number
  app.get("/api/shipments/next-number", async (req, res) => {
    try {
      const nextNumber = await storage.getNextShipmentNumber();
      res.json({ shipment_number: nextNumber });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assign shipments to invoice
  app.post("/api/shipments/assign-invoice", async (req, res) => {
    try {
      const { shipment_ids, invoice_id } = req.body;
      if (!Array.isArray(shipment_ids)) {
        return res.status(400).json({ message: "shipment_ids must be an array" });
      }
      await storage.assignShipmentsToInvoice(shipment_ids, invoice_id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invoice routes
  app.get("/api/invoices/order/:orderId", async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByOrderId(parseInt(req.params.orderId));
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceById(parseInt(req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const validatedData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(validatedData);
      
      // If shipment_ids are provided, assign them to this invoice
      if (req.body.shipment_ids && Array.isArray(req.body.shipment_ids)) {
        await storage.assignShipmentsToInvoice(req.body.shipment_ids, invoice.id);
      }
      
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const validatedData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(parseInt(req.params.id), validatedData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // If shipment_ids are provided, update the assignments
      if (req.body.shipment_ids && Array.isArray(req.body.shipment_ids)) {
        // First unassign all shipments from this invoice
        const existingShipments = await storage.getShipmentsByOrderId(invoice.order_id);
        const currentlyAssigned = existingShipments.filter(s => s.invoice_id === invoice.id);
        if (currentlyAssigned.length > 0) {
          await storage.assignShipmentsToInvoice(currentlyAssigned.map(s => s.id), null);
        }
        // Then assign the new shipments
        await storage.assignShipmentsToInvoice(req.body.shipment_ids, invoice.id);
      }
      
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      await storage.deleteInvoice(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accessories routes
  app.get("/api/accessories", async (req, res) => {
    try {
      const accessories = await storage.getAllAccessories();
      res.json(accessories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/accessories/:id", async (req, res) => {
    try {
      const accessory = await storage.getAccessoryById(parseInt(req.params.id));
      if (!accessory) {
        return res.status(404).json({ message: "Accessory not found" });
      }
      res.json(accessory);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/accessories", async (req, res) => {
    try {
      const validatedData = insertAccessorySchema.parse(req.body);
      const accessory = await storage.createAccessory(validatedData);
      res.status(201).json(accessory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/accessories/:id", async (req, res) => {
    try {
      const validatedData = insertAccessorySchema.partial().parse(req.body);
      const accessory = await storage.updateAccessory(parseInt(req.params.id), validatedData);
      if (!accessory) {
        return res.status(404).json({ message: "Accessory not found" });
      }
      res.json(accessory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/accessories/:id", async (req, res) => {
    try {
      await storage.deleteAccessory(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Casters routes
  app.get("/api/casters", async (req, res) => {
    try {
      const casters = await storage.getAllCasters();
      res.json(casters);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/casters/:id", async (req, res) => {
    try {
      const caster = await storage.getCasterById(parseInt(req.params.id));
      if (!caster) {
        return res.status(404).json({ message: "Caster not found" });
      }
      res.json(caster);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/casters/:id/stats", async (req, res) => {
    try {
      const casterId = parseInt(req.params.id);
      const caster = await storage.getCasterById(casterId);
      if (!caster) {
        return res.status(404).json({ message: "Caster not found" });
      }
      const stats = await storage.getCasterRejectionStats(casterId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/casters", async (req, res) => {
    try {
      const validatedData = insertCasterSchema.parse(req.body);
      const caster = await storage.createCaster(validatedData);
      res.status(201).json(caster);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/casters/:id", async (req, res) => {
    try {
      const validatedData = insertCasterSchema.partial().parse(req.body);
      const caster = await storage.updateCaster(parseInt(req.params.id), validatedData);
      if (!caster) {
        return res.status(404).json({ message: "Caster not found" });
      }
      res.json(caster);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/casters/:id", async (req, res) => {
    try {
      await storage.deleteCaster(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      // Check for foreign key constraint (caster used in batches)
      if (error.message && error.message.toLowerCase().includes('foreign key constraint')) {
        return res.status(400).json({ 
          message: "Cannot delete this caster because they have existing batches. Please remove their batches first." 
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Purchase Orders routes
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      const allPOs = await storage.getAllPurchaseOrders();
      const allCasters = await storage.getAllCasters();
      const allItems = await storage.getAllItems();
      
      const posWithDetails = await Promise.all(
        allPOs.map(async (po) => {
          const caster = allCasters.find(c => c.id === po.caster_id);
          const poItems = await storage.getPurchaseOrderItemsByPOId(po.id);
          
          const line_items = poItems.map(poi => {
            const item = allItems.find(i => i.id === poi.item_id);
            return {
              ...poi,
              item_name: item?.name || '',
              sku: item?.sku || '',
            };
          });

          return {
            ...po,
            caster_name: caster?.name || '',
            line_items,
          };
        })
      );

      res.json(posWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const po = await storage.getPurchaseOrderById(parseInt(req.params.id));
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      const caster = await storage.getCasterById(po.caster_id);
      const poItems = await storage.getPurchaseOrderItemsByPOId(po.id);
      const allItems = await storage.getAllItems();

      const line_items = poItems.map(poi => {
        const item = allItems.find(i => i.id === poi.item_id);
        return {
          ...poi,
          item_name: item?.name || '',
          sku: item?.sku || '',
        };
      });

      res.json({
        ...po,
        caster_name: caster?.name || '',
        line_items,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      const { line_items, ...poData } = req.body;
      
      const validatedPO = insertPurchaseOrderSchema.parse({
        ...poData,
        status: poData.status || 'confirmed',
      });

      const po = await storage.createPurchaseOrder(validatedPO);

      if (line_items && Array.isArray(line_items)) {
        for (const item of line_items) {
          await storage.createPurchaseOrderItem({
            purchase_order_id: po.id,
            item_id: item.item_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
          });
        }
      }

      res.status(201).json(po);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: "PO number already exists" });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { line_items, ...poData } = req.body;
      
      const po = await storage.updatePurchaseOrder(id, poData);
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      if (line_items && Array.isArray(line_items)) {
        await storage.deletePurchaseOrderItemsByPOId(id);
        for (const item of line_items) {
          await storage.createPurchaseOrderItem({
            purchase_order_id: id,
            item_id: item.item_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: item.quantity_received || 0,
          });
        }
        await storage.recalculatePurchaseOrderReceived(id);
        await storage.checkAndAutoCompletePurchaseOrder(id);
      }

      const updated = await storage.getPurchaseOrderById(id);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/purchase-orders/:id", async (req, res) => {
    try {
      await storage.deletePurchaseOrder(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get purchase orders for a specific caster (for batch linking)
  app.get("/api/purchase-orders/by-caster/:casterId", async (req, res) => {
    try {
      const casterId = parseInt(req.params.casterId);
      const pos = await storage.getPurchaseOrdersByCasterId(casterId);
      
      const allItems = await storage.getAllItems();
      const posWithItems = await Promise.all(
        pos.filter(po => po.status === 'confirmed' || po.status === 'completed').map(async (po) => {
          const poItems = await storage.getPurchaseOrderItemsByPOId(po.id);
          const line_items = poItems.map(poi => {
            const item = allItems.find(i => i.id === poi.item_id);
            return {
              ...poi,
              item_name: item?.name || '',
            };
          });
          return { ...po, line_items };
        })
      );

      res.json(posWithItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
