// Month-by-month closing stock per vendor and item, rebuilt from the raw
// records (batches in, shipments / kit uses / coating sends out) rather than
// stored anywhere — so every number can be traced to the movements behind it.
//
// Kept as a pure function over plain rows so it can be reasoned about and
// tested without touching the database.

export type MovementType = "purchase" | "coating_return" | "rework_replacement" | "sale" | "kit_component" | "coating_send";

export interface LedgerMovement {
  id: string;
  type: MovementType;
  direction: "in" | "out";
  date: string; // YYYY-MM-DD
  vendor_id: number | null;
  vendor_name: string; // who made / supplied the batch this movement touches
  item_id: number;
  quantity: number; // always positive
  reference: string; // batch no. / shipment no.
  party: string; // customer, coating vendor, kit, ...
  note: string;
}

export interface LedgerInput {
  items: Array<{ id: number; name: string; sku: string; size_specification: string; finish: string | null; is_kit: boolean }>;
  casters: Array<{ id: number; name: string }>;
  customers: Array<{ id: number; company_name: string }>;
  orders: Array<{ id: number; customer_id: number; po_number: string }>;
  orderItems: Array<{ id: number; item_id: number; variant_note: string | null }>;
  batches: Array<{
    id: number;
    item_id: number;
    caster_id: number | null;
    batch_number: string;
    received_date: string;
    quantity_produced: number;
    quantity_remaining: number;
    color: string | null;
  }>;
  shipments: Array<{
    id: number;
    order_id: number;
    order_item_id: number;
    shipment_number: string | null;
    batch_number: string | null;
    quantity_shipped: number;
    shipment_date: string;
    is_backfill: boolean;
  }>;
  kitAllocations: Array<{
    id: number;
    shipment_id: number;
    component_type: string;
    batch_id: number | null;
    quantity: number;
  }>;
  coatingConversions: Array<{
    id: number;
    bare_item_id: number;
    coated_item_id: number;
    caster_id: number | null;
    quantity_sent: number;
    sent_date: string;
    color: string | null;
    quantity_received: number | null;
    received_date: string | null;
    output_batch_id: number | null;
    status: string;
  }>;
  coatingAllocations: Array<{ id: number; coating_conversion_id: number; batch_id: number; quantity: number }>;
  reworks: Array<{ replacement_batch_id: number | null }>;
}

export interface LedgerMonth {
  in: number;
  out: number;
  closing: number;
}

export interface LedgerRow {
  key: string;
  item_id: number;
  item_name: string;
  sku: string;
  size_specification: string;
  finish: string | null;
  opening: number;
  months: Record<string, LedgerMonth>;
}

export interface InTransitRow {
  key: string;
  vendor_id: number | null;
  vendor_name: string;
  bare_item_id: number;
  bare_item_name: string;
  coated_item_name: string;
  months: Record<string, { quantity: number; conversions: Array<{ id: number; sent_date: string; quantity: number; color: string | null }> }>;
}

export interface BatchMismatch {
  batch_number: string;
  item_name: string;
  vendor_name: string;
  produced: number;
  taken_out: number;
  expected_remaining: number;
  system_remaining: number;
  difference: number;
}

export interface LedgerResult {
  months: string[]; // YYYY-MM, oldest first
  rows: LedgerRow[];
  in_transit: InTransitRow[];
  movements: LedgerMovement[]; // every movement up to the end of the last month
  mismatches: BatchMismatch[];
  earliest_month: string | null;
}

const NO_VENDOR = "No vendor";

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function listMonths(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

export function buildStockLedger(input: LedgerInput, from: string, to: string): LedgerResult {
  const itemById = new Map(input.items.map((i) => [i.id, i]));
  const casterName = new Map(input.casters.map((c) => [c.id, c.name]));
  const customerName = new Map(input.customers.map((c) => [c.id, c.company_name]));
  const orderById = new Map(input.orders.map((o) => [o.id, o]));
  const orderItemById = new Map(input.orderItems.map((o) => [o.id, o]));
  const batchById = new Map(input.batches.map((b) => [b.id, b]));
  const batchByNumber = new Map(input.batches.map((b) => [b.batch_number, b]));
  const shipmentById = new Map(input.shipments.map((s) => [s.id, s]));
  const conversionById = new Map(input.coatingConversions.map((c) => [c.id, c]));
  const reworkBatchIds = new Set(input.reworks.map((r) => r.replacement_batch_id).filter((x): x is number => x != null));
  const coatingOutputBatchIds = new Map<number, number>();
  for (const c of input.coatingConversions) if (c.output_batch_id != null) coatingOutputBatchIds.set(c.output_batch_id, c.id);

  const vendorName = (id: number | null) => (id == null ? NO_VENDOR : casterName.get(id) ?? `Vendor #${id}`);
  const itemName = (id: number) => itemById.get(id)?.name ?? `Item #${id}`;

  const movements: LedgerMovement[] = [];
  const takenOutByBatch = new Map<number, number>();
  const addOut = (batchId: number, qty: number) => takenOutByBatch.set(batchId, (takenOutByBatch.get(batchId) ?? 0) + qty);

  // --- In: every batch, dated by when it was received
  for (const b of input.batches) {
    let type: MovementType = "purchase";
    let party = vendorName(b.caster_id);
    let note = b.color ? `Colour: ${b.color}` : "";
    const conversionId = coatingOutputBatchIds.get(b.id);
    if (conversionId != null) {
      type = "coating_return";
      note = `Back from coating #${conversionId}${b.color ? ` · ${b.color}` : ""}`;
    } else if (reworkBatchIds.has(b.id)) {
      type = "rework_replacement";
      note = "Replacement for reworked pieces";
    }
    movements.push({
      id: `batch-${b.id}`,
      type,
      direction: "in",
      date: b.received_date,
      vendor_id: b.caster_id,
      vendor_name: vendorName(b.caster_id),
      item_id: b.item_id,
      quantity: b.quantity_produced,
      reference: b.batch_number,
      party,
      note,
    });
  }

  // --- Out: shipments drawn from a specific batch
  for (const s of input.shipments) {
    if (s.is_backfill || !s.batch_number) continue; // backfills never touched stock; batch-less ones are kit headers
    const batch = batchByNumber.get(s.batch_number);
    if (!batch) continue;
    addOut(batch.id, s.quantity_shipped);
    const order = orderById.get(s.order_id);
    movements.push({
      id: `ship-${s.id}`,
      type: "sale",
      direction: "out",
      date: s.shipment_date,
      vendor_id: batch.caster_id,
      vendor_name: vendorName(batch.caster_id),
      item_id: batch.item_id,
      quantity: s.quantity_shipped,
      reference: s.shipment_number || `Shipment #${s.id}`,
      party: order ? customerName.get(order.customer_id) ?? "" : "",
      note: [order ? `PO ${order.po_number}` : "", `from batch ${batch.batch_number}`].filter(Boolean).join(" · "),
    });
  }

  // --- Out: components consumed by kit shipments
  for (const a of input.kitAllocations) {
    if (a.component_type !== "item" || a.batch_id == null) continue;
    const batch = batchById.get(a.batch_id);
    const s = shipmentById.get(a.shipment_id);
    if (!batch || !s) continue;
    addOut(batch.id, a.quantity);
    const order = orderById.get(s.order_id);
    const kit = itemById.get(orderItemById.get(s.order_item_id)?.item_id ?? -1);
    movements.push({
      id: `kit-${a.id}`,
      type: "kit_component",
      direction: "out",
      date: s.shipment_date,
      vendor_id: batch.caster_id,
      vendor_name: vendorName(batch.caster_id),
      item_id: batch.item_id,
      quantity: a.quantity,
      reference: s.shipment_number || `Shipment #${s.id}`,
      party: order ? customerName.get(order.customer_id) ?? "" : "",
      note: [kit ? `Part of kit ${kit.name}` : "Part of a kit", order ? `PO ${order.po_number}` : "", `from batch ${batch.batch_number}`]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // --- Out: bare castings sent for coating
  for (const a of input.coatingAllocations) {
    const batch = batchById.get(a.batch_id);
    const c = conversionById.get(a.coating_conversion_id);
    if (!batch || !c) continue;
    addOut(batch.id, a.quantity);
    movements.push({
      id: `coat-${a.id}`,
      type: "coating_send",
      direction: "out",
      date: c.sent_date,
      vendor_id: batch.caster_id,
      vendor_name: vendorName(batch.caster_id),
      item_id: batch.item_id,
      quantity: a.quantity,
      reference: `Coating #${c.id}`,
      party: `Coating at ${vendorName(c.caster_id)}`,
      note: [`→ ${itemName(c.coated_item_id)}`, c.color ?? "", `from batch ${batch.batch_number}`].filter(Boolean).join(" · "),
    });
  }

  movements.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const months = listMonths(from, to);
  const lastMonth = months[months.length - 1];
  const horizon = lastDayOf(lastMonth);
  const used = movements.filter((m) => m.date <= horizon);

  // --- Grid
  const rowMap = new Map<string, LedgerRow>();
  const rowFor = (itemId: number) => {
    const key = `${itemId}`;
    let row = rowMap.get(key);
    if (!row) {
      const item = itemById.get(itemId);
      row = {
        key,
        item_id: itemId,
        item_name: itemName(itemId),
        sku: item?.sku ?? "",
        size_specification: item?.size_specification ?? "",
        finish: item?.finish ?? null,
        opening: 0,
        months: Object.fromEntries(months.map((m) => [m, { in: 0, out: 0, closing: 0 }])),
      };
      rowMap.set(key, row);
    }
    return row;
  };

  for (const m of used) {
    const row = rowFor(m.item_id);
    const signed = m.direction === "in" ? m.quantity : -m.quantity;
    const month = monthOf(m.date);
    if (month < months[0]) {
      row.opening += signed;
    } else {
      const cell = row.months[month];
      if (m.direction === "in") cell.in += m.quantity;
      else cell.out += m.quantity;
    }
  }
  for (const row of Array.from(rowMap.values())) {
    let running = row.opening;
    for (const mo of months) {
      running += row.months[mo].in - row.months[mo].out;
      row.months[mo].closing = running;
    }
  }
  const rows = Array.from(rowMap.values())
    .filter((r) => r.opening !== 0 || months.some((mo) => r.months[mo].in || r.months[mo].out || r.months[mo].closing))
    .sort(
      (a, b) =>
        a.item_name.localeCompare(b.item_name) ||
        a.size_specification.localeCompare(b.size_specification)
    );

  // --- Sent for coating but not back yet, as of each month end
  const transitMap = new Map<string, InTransitRow>();
  for (const c of input.coatingConversions) {
    for (const mo of months) {
      const end = lastDayOf(mo);
      const pending = c.sent_date <= end && !(c.status === "received" && c.received_date && c.received_date <= end);
      if (!pending) continue;
      const key = `${c.caster_id ?? "none"}:${c.bare_item_id}:${c.coated_item_id}`;
      let row = transitMap.get(key);
      if (!row) {
        row = {
          key,
          vendor_id: c.caster_id,
          vendor_name: vendorName(c.caster_id),
          bare_item_id: c.bare_item_id,
          bare_item_name: itemName(c.bare_item_id),
          coated_item_name: itemName(c.coated_item_id),
          months: Object.fromEntries(months.map((m) => [m, { quantity: 0, conversions: [] }])),
        };
        transitMap.set(key, row);
      }
      row.months[mo].quantity += c.quantity_sent;
      row.months[mo].conversions.push({ id: c.id, sent_date: c.sent_date, quantity: c.quantity_sent, color: c.color });
    }
  }
  const in_transit = Array.from(transitMap.values()).sort(
    (a, b) => a.vendor_name.localeCompare(b.vendor_name) || a.bare_item_name.localeCompare(b.bare_item_name)
  );

  // --- Does the rebuilt history agree with what Batches says is left?
  const mismatches: BatchMismatch[] = [];
  for (const b of input.batches) {
    const out = takenOutByBatch.get(b.id) ?? 0;
    const expected = b.quantity_produced - out;
    if (expected !== b.quantity_remaining) {
      mismatches.push({
        batch_number: b.batch_number,
        item_name: itemName(b.item_id),
        vendor_name: vendorName(b.caster_id),
        produced: b.quantity_produced,
        taken_out: out,
        expected_remaining: expected,
        system_remaining: b.quantity_remaining,
        difference: b.quantity_remaining - expected,
      });
    }
  }

  const earliest = movements.length ? monthOf(movements[0].date) : null;
  return { months, rows, in_transit, movements: used, mismatches, earliest_month: earliest };
}
