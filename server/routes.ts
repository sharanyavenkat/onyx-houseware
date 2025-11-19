import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyPassword } from "./auth";
import { requireAuth } from "./middleware";
import { insertItemSchema, insertCustomerSchema, insertOrderSchema, insertOrderItemSchema, insertIndentSchema, insertShipmentSchema, insertBatchSchema, updateBatchSchema } from "@shared/schema";
import { db } from "./db";
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

      // Set session
      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        username: user.username
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
        username: user.username
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
      await storage.deleteItem(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      // Check if it's a foreign key constraint error (case-insensitive)
      if (error.message && error.message.toLowerCase().includes('foreign key constraint')) {
        return res.status(400).json({ 
          message: "Cannot delete this item because it is referenced in existing orders. Please delete the related orders first." 
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Batch routes
  // Get opening balance from batches (must come before general /api/batches route)
  app.get("/api/batches/opening-balance", async (req, res) => {
    try {
      // Support optional includeAcceptable query parameter (default true)
      const includeAcceptable = req.query.includeAcceptable !== 'false';
      const openingBalance = await storage.getOpeningBalanceByItemWithQuality(includeAcceptable);
      res.json(openingBalance);
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
      const enrichedBatches = batches.map(batch => ({
        ...batch,
        quantity_shipped: batch.quantity_produced - batch.quantity_remaining - batch.quantity_rejected
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

  app.post("/api/batches", async (req, res) => {
    try {
      // Extract and validate only required fields via schema
      const requiredInput = {
        item_id: req.body.item_id,
        batch_number: req.body.batch_number,
        received_date: req.body.received_date,
        quantity_produced: req.body.quantity_produced
      };

      // Schema validation for required fields only
      const validated = insertBatchSchema.pick({
        item_id: true,
        batch_number: true,
        received_date: true,
        quantity_produced: true
      }).parse(requiredInput);

      // Handle optional fields separately (preserve caller intent)
      const quality_status = req.body.quality_status ?? 'Good';
      const notes = req.body.notes ?? null;

      // Additional business rules validation
      if (validated.quantity_produced < 0) {
        return res.status(400).json({ message: "Quantity produced cannot be negative" });
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
      // For new batches: remaining = produced (no shipments/rejections yet)
      const batchData = {
        item_id: validated.item_id,
        batch_number: validated.batch_number,
        received_date: validated.received_date,
        quantity_produced: validated.quantity_produced,
        quantity_remaining: validated.quantity_produced,  // Server-computed
        quantity_rejected: 0,                             // Server-computed
        quality_status: quality_status,                   // Server-defaulted
        is_depleted: validated.quantity_produced === 0,   // Server-computed
        notes: notes                                      // Preserves empty strings
      };

      // Create batch
      const batch = await storage.createBatch(batchData);
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
      
      // Use unified storage.updateBatch method
      const updatedBatch = await storage.updateBatch(id, validationResult.data);
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
      await storage.deleteBatch(id);
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
        await storage.deleteOrderItems(order.id);
        
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

  const httpServer = createServer(app);

  return httpServer;
}
