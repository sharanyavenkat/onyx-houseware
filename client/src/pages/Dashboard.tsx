import DashboardCards from '../components/DashboardCards';
import { Link } from 'wouter';
import DataTable from '../components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import type { Item, Order, Customer, Indent, Accessory } from '@shared/schema';
import { calculateInventoryMetrics } from '@shared/inventory';

type VendorAttentionEntry = {
  casterId: number;
  casterName: string;
  rejectionRatePct: number | null;
  metalBalanceKg: number | null;
  flagReason: string;
};

// Extended Order type with line_items from API
type OrderWithLineItems = Order & {
  line_items?: Array<{
    item_id: number;
    item_name: string;
    sku: string;
    quantity: number;
  }>;
};

const topItemsColumns = [
  { key: 'name', label: 'Item Name', isPrimary: true },
  { key: 'pendingQty', label: 'Pending Orders' },
  { key: 'workingStock', label: 'Total Available', hideOnMobile: true },
  { key: 'shortfall', label: 'Still Need to Order' },
  { 
    key: 'status', 
    label: 'Status', 
    render: (value: string) => {
      const variant = value === 'Critical' ? 'destructive' : value === 'Low' ? 'secondary' : 'default';
      return <Badge variant={variant}>{value}</Badge>;
    }
  }
];

export default function Dashboard() {
  // Default to current month for indent data
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [projectionMonth, setProjectionMonth] = useState(currentMonth);
  const { canMutate } = useAuth();

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['/api/items'],
  });

  const { data: orders = [] } = useQuery<OrderWithLineItems[]>({
    queryKey: ['/api/orders'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Fetch indent data for current month to get expected receipts and safety stock
  const { data: indents = [] } = useQuery<Indent[]>({
    queryKey: ['/api/indents', currentMonth],
  });

  // Fetch actual on-hand stock from batches (real-time, includes acceptable quality)
  const { data: onHandStock = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/batches/on-hand-stock', true],
    queryFn: async () => {
      const response = await fetch('/api/batches/on-hand-stock?includeAcceptable=true');
      if (!response.ok) throw new Error('Failed to fetch on-hand stock');
      return response.json();
    },
  });

  // Fetch pending orders from backend (accounts for shipped and rejected quantities)
  const { data: pendingByItem = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/orders/pending-by-item'],
  });

  // Fetch accessories for low stock monitoring
  const { data: accessories = [] } = useQuery<Accessory[]>({
    queryKey: ['/api/accessories'],
  });

  // Vendors flagged for high rejection rate or an outstanding metal balance
  const { data: vendorAttention = [] } = useQuery<VendorAttentionEntry[]>({
    queryKey: ['/api/casters/attention-summary'],
  });

  // Projections: a manual, per-item "what we're telling casters we'll need"
  // figure — deliberately separate from Indent's calculated numbers, shown
  // alongside them for comparison, not instead of them. Read-only here
  // (rolled up across customers) — actual entry happens per-customer on the
  // dedicated Projections page, since that's dad's real input shape.
  const { data: projectionsData = [] } = useQuery<Array<{ item_id: number; item_name: string; sku: string; quantity: number }>>({
    queryKey: ['/api/projections', projectionMonth],
    queryFn: async () => {
      const res = await fetch(`/api/projections/${projectionMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch projections');
      return res.json();
    },
  });

  // Indent data for the SAME month as the projection, so "required to order"
  // can be shown right next to it — separate from the currentMonth indents
  // query above, which the "Items Requiring Attention" table intentionally stays on.
  const { data: projectionMonthIndents = [] } = useQuery<Indent[]>({
    queryKey: ['/api/indents', projectionMonth],
  });

  // A quiet nudge, not an auto-switch — if next month already has
  // projections entered, say so next to the selector rather than silently
  // changing which month the page opens to. Keeps "what will I see when I
  // open this page" predictable while still surfacing that planning-ahead
  // has started.
  const { data: nextMonthProjections = [] } = useQuery<Array<{ quantity: number }>>({
    queryKey: ['/api/projections', nextMonth, 'nudge-check'],
    queryFn: async () => {
      const res = await fetch(`/api/projections/${nextMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch projections');
      return res.json();
    },
    enabled: projectionMonth !== nextMonth,
  });
  const nextMonthHasData = projectionMonth !== nextMonth && nextMonthProjections.some(p => p.quantity > 0);
  const nextMonthLabel = nextMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const projectionComparison = useMemo(() => {
    return projectionsData.map(p => {
      const item = items.find(i => i.id === p.item_id);
      const currentStock = onHandStock[p.item_id] ?? 0;
      const pendingQty = pendingByItem[p.item_id] ?? 0;
      const indent = projectionMonthIndents.find(i => i.item_id === p.item_id);
      const expectedReceipts = indent?.expected_receipts ?? 0;
      const currentSafetyStock = indent?.current_safety_stock ?? 0;
      const metrics = calculateInventoryMetrics(
        currentStock,
        expectedReceipts,
        pendingQty,
        currentSafetyStock,
        item?.desired_safety_stock || 0
      );
      return {
        ...p,
        requiredToOrder: metrics.totalRequired,
      };
    });
  }, [projectionsData, items, onHandStock, pendingByItem, projectionMonthIndents]);

  // Extract unique months from orders based on fulfillment_date
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(order => {
      if (order.fulfillment_date) {
        const date = new Date(order.fulfillment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  // Filter orders by selected month (based on fulfillment_date)
  const filteredOrders = useMemo(() => {
    if (selectedMonth === 'all') return orders;
    
    return orders.filter(order => {
      if (!order.fulfillment_date) return false;
      const date = new Date(order.fulfillment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === selectedMonth;
    });
  }, [orders, selectedMonth]);

  const dashboardData = {
    totalOrders: filteredOrders.length,
    pendingOrders: filteredOrders.filter(o => o.status === 'draft' || o.status === 'confirmed').length,
    totalItems: items.filter(item => item.is_active).length,
    totalCustomers: customers.length
  };

  // Calculate top items by pending quantity using actual on-hand stock from batches
  const topItemsByPendingQty = useMemo(() => {
    // Calculate metrics for ALL active items (not just those with pending orders)
    const itemMetrics = items
      .filter(item => item.is_active)
      .map(item => {
        // Get actual on-hand stock from batches (real-time, includes acceptable quality)
        const currentStock = onHandStock[item.id] ?? 0;
        
        // Get pending orders for this item (defaults to 0 if no pending orders)
        const pendingQty = pendingByItem[item.id] ?? 0;
        
        // Get indent data for expected receipts and safety stock (current month)
        const indent = indents.find(i => i.item_id === item.id);
        const expectedReceipts = indent?.expected_receipts ?? 0;
        const currentSafetyStock = indent?.current_safety_stock ?? 0;
        
        // Calculate using actual on-hand stock from batches with two-tier safety stock
        const metrics = calculateInventoryMetrics(
          currentStock,
          expectedReceipts,
          pendingQty,
          currentSafetyStock,
          item.desired_safety_stock || 0
        );
        
        return {
          name: item.name,
          pendingQty,
          workingStock: metrics.usableStock, // Total available (working stock + current safety stock)
          shortfall: metrics.shortfallToFulfill, // Only what's needed to fulfill orders
          status: metrics.safetyStockStatus === 'critical' ? 'Critical' 
                : metrics.safetyStockStatus === 'low' ? 'Low' 
                : 'Good'
        };
      })
      .sort((a, b) => b.shortfall - a.shortfall)
      .slice(0, 5);
    
    return itemMetrics;
  }, [items, pendingByItem, indents, onHandStock]);

  // Calculate accessories with low stock
  const lowStockAccessories = useMemo(() => {
    return accessories
      .filter(acc => acc.status === 'active' && acc.stock_on_hand <= acc.safety_stock)
      .map(acc => ({
        name: acc.name,
        stock_on_hand: acc.stock_on_hand,
        safety_stock: acc.safety_stock,
        shortage: Math.max(0, acc.safety_stock - acc.stock_on_hand),
      }))
      .sort((a, b) => b.shortage - a.shortage);
  }, [accessories]);

  const accessoriesColumns = [
    { key: 'name', label: 'Accessory', isPrimary: true },
    { key: 'stock_on_hand', label: 'Stock on Hand' },
    { key: 'safety_stock', label: 'Safety Stock', hideOnMobile: true },
    { 
      key: 'shortage', 
      label: 'Shortage', 
      render: (value: number) => (
        <Badge variant={value > 0 ? 'destructive' : 'secondary'}>
          {value > 0 ? `-${value}` : 'OK'}
        </Badge>
      )
    }
  ];

  const vendorAttentionColumns = [
    { key: 'casterName', label: 'Vendor', isPrimary: true },
    {
      key: 'rejectionRatePct',
      label: 'Rejection Rate',
      render: (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`,
    },
    {
      key: 'metalBalanceKg',
      label: 'Metal Balance',
      hideOnMobile: true,
      render: (value: number | null) => value === null ? '—' : `${value.toFixed(0)} kg`,
    },
    {
      key: 'flagReason',
      label: 'Why',
      render: (value: string) => <Badge variant="destructive">{value}</Badge>,
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your order management system</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by Fulfillment Month:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-filter-month">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {availableMonths.map(month => {
                const [year, monthNum] = month.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'long' });
                return (
                  <SelectItem key={month} value={month}>
                    {monthName} {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards */}
      <DashboardCards data={dashboardData} />

      {/* Items Requiring Attention */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div>
            <h2 className="text-xl font-semibold">Items Requiring Attention</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Shows items with pending orders using current month's indent data (Current Stock from Batches + Expected Receipts + Safety Stock). 
              "Still Need to Order" shows the shortfall to fulfill pending orders after using all available stock. Visit Indent page for detailed planning.
            </p>
          </div>
        </div>
        <DataTable 
          columns={topItemsColumns}
          data={topItemsByPendingQty}
          title=""
          searchable={false}
        />
      </div>

      {/* Projections — manual figures for casters, shown next to Indent's calculated number */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Projections</h2>
            <p className="text-sm text-muted-foreground mt-1">
              What we're telling casters we'll need, rolled up from what each customer has told us — bare castings only, since that's what's actually ordered from a caster.
              Shown next to Indent's calculated "required to order" for the same month; the two won't always match, and that gap is useful information.
              {" "}<Link href="/projections" className="underline">Enter or edit projections by customer →</Link>
            </p>
          </div>
          <Select value={projectionMonth} onValueChange={setProjectionMonth}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-projection-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map(offset => {
                const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                return <SelectItem key={key} value={key}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        {nextMonthHasData && (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline -mt-2"
            onClick={() => setProjectionMonth(nextMonth)}
            data-testid="button-next-month-nudge"
          >
            {nextMonthLabel} already has projections entered →
          </button>
        )}
        <div className="border rounded-md divide-y">
          <div className="hidden sm:flex gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
            <div className="flex-1">Item</div>
            <div className="w-40">Projection (all customers)</div>
            <div className="w-40">Required to Order (Indent)</div>
          </div>
          {projectionComparison.map(row => (
            <div key={row.item_id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2" data-testid={`projection-row-${row.item_id}`}>
              <div className="flex-1">
                <div className="font-medium text-sm">{row.item_name}</div>
                <div className="text-xs text-muted-foreground">{row.sku}</div>
              </div>
              <div className="w-full sm:w-40 font-mono">{row.quantity}</div>
              <div className="w-full sm:w-40 font-mono text-sm">{row.requiredToOrder}</div>
            </div>
          ))}
          {projectionComparison.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No castable items to project yet.</p>
          )}
        </div>
      </div>

      {/* Accessories Low Stock */}
      {lowStockAccessories.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-xl font-semibold">Accessories Low Stock</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Active accessories where stock on hand is at or below safety stock level. 
                Visit the Accessories page to update inventory.
              </p>
            </div>
          </div>
          <DataTable 
            columns={accessoriesColumns}
            data={lowStockAccessories}
            title=""
            searchable={false}
          />
        </div>
      )}

      {/* Vendors Requiring Attention */}
      {vendorAttention.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div>
              <h2 className="text-xl font-semibold">Vendors Requiring Attention</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vendors with an all-time rejection rate of 10%+, or a metal balance beyond what their production accounts for.
                Visit the Vendors page for details.
              </p>
            </div>
          </div>
          <DataTable
            columns={vendorAttentionColumns}
            data={vendorAttention}
            title=""
            searchable={false}
          />
        </div>
      )}
    </div>
  );
}