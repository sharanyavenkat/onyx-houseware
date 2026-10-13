import type { Express } from "express";
import { db } from "./db/client";
import {
  items,
  casters,
  customers,
  orders,
  orderItems,
  batches,
  shipments,
  kitShipmentAllocations,
  coatingConversions,
  coatingConversionAllocations,
  reworks,
} from "@shared/schema";
import { buildStockLedger, listMonths } from "./stockLedger";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function registerStockLedgerRoutes(app: Express) {
  // GET /api/stock-ledger?from=YYYY-MM&to=YYYY-MM
  // Closing stock per vendor × item for each month, plus every movement
  // behind it. Defaults to the last 6 months (or since the first record).
  app.get("/api/stock-ledger", async (req, res) => {
    try {
      const nowMonth = new Date().toISOString().slice(0, 7);
      const to = typeof req.query.to === "string" && req.query.to ? req.query.to : nowMonth;
      if (!MONTH_RE.test(to)) return res.status(400).json({ message: "'to' must be a month like 2026-10" });
      let from = typeof req.query.from === "string" && req.query.from ? req.query.from : "";
      if (from && !MONTH_RE.test(from)) return res.status(400).json({ message: "'from' must be a month like 2026-04" });

      const input = {
        items: (await db.select().from(items)).map((i) => ({ ...i, is_kit: !!i.is_kit })),
        casters: await db.select().from(casters),
        customers: await db.select().from(customers),
        orders: await db.select().from(orders),
        orderItems: await db.select().from(orderItems),
        batches: await db.select().from(batches),
        shipments: (await db.select().from(shipments)).map((s) => ({ ...s, is_backfill: !!s.is_backfill })),
        kitAllocations: await db.select().from(kitShipmentAllocations),
        coatingConversions: await db.select().from(coatingConversions),
        coatingAllocations: await db.select().from(coatingConversionAllocations),
        reworks: await db.select().from(reworks),
      };

      if (!from) {
        const probe = buildStockLedger(input, to, to);
        const sixBack = shiftMonth(to, -5);
        from = probe.earliest_month && probe.earliest_month > sixBack ? probe.earliest_month : sixBack;
        if (from > to) from = to;
      }
      if (from > to) return res.status(400).json({ message: "'from' must not be after 'to'" });
      if (listMonths(from, to).length > 36) return res.status(400).json({ message: "Please pick 36 months or fewer" });

      res.json(buildStockLedger(input, from, to));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
