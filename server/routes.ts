import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertItemSchema, insertCustomerSchema, insertOrderSchema, insertOrderItemSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
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

  const httpServer = createServer(app);

  return httpServer;
}
